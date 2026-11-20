import { expect, test, type Page } from "@playwright/test";
import { loginAs } from "./helpers";

// The fake identity service keeps its data while it runs. These tests change the
// same few cases, so they run one after another and each starts from fresh data.
test.describe.configure({ mode: "serial" });

const IDENTITY_SERVICE_URL = process.env.IDENTITY_SERVICE_URL ?? "http://localhost:4002";

test.beforeEach(async ({ request }) => {
  await request.post(`${IDENTITY_SERVICE_URL}/__reset`);
});

/** The value shown next to a label on the detail page. */
function field(page: Page, label: string) {
  return page.locator("dl > div").filter({ has: page.getByText(label, { exact: true }) }).locator("dd");
}

test("Kim claims an unassigned case, sees its full ID number, and approves it", async ({ page }) => {
  await loginAs(page, "kim@example.test");
  await page.goto("/kyc");
  await expect(page.getByRole("heading", { name: "KYC review queue" })).toBeVisible();

  // case_001: Marigold Thistlewood, passport, risk 12, nobody assigned.
  const row = page.getByRole("row").filter({ hasText: "case_001" });
  await expect(row).toContainText("Marigold Thistlewood");
  await expect(row).toContainText("Passport");
  await expect(row).toContainText("12");
  await expect(row).toContainText("open");
  await expect(row).toContainText("Unassigned");
  await row.getByRole("link").click();
  await expect(page.getByRole("heading", { name: "Case case_001" })).toBeVisible();

  // Not Kim's case yet: the server sends only the last four characters.
  await expect(field(page, "ID number (masked)")).toHaveText("••••0001");
  expect(await page.content()).not.toContain("FAKE-P-00001");
  await expect(field(page, "Date of birth")).toHaveText("1988-03-14");
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reject" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Escalate" })).toHaveCount(0);

  await page.getByRole("button", { name: "Claim" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(field(page, "Assigned to")).toHaveText("kim@example.test");
  await expect(field(page, "ID number")).toHaveText("FAKE-P-00001");
  await expect(page.getByRole("button", { name: "Claim" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Escalate" })).toBeVisible();

  await page.getByRole("button", { name: "Approve" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(field(page, "Status")).toHaveText("approved");
  await expect(field(page, "Decided by")).toHaveText("kim@example.test");
  await expect(field(page, "Decided at")).toHaveText(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$/);
  await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
});

test("Noor rejects a high-risk case assigned to Lee, with a note", async ({ page }) => {
  await loginAs(page, "noor@example.test");
  // case_006: Rosalind Emberly, risk 81, assigned to Lee.
  await page.goto("/kyc/case_006");
  await expect(field(page, "Customer")).toHaveText("Rosalind Emberly");
  await expect(field(page, "ID number")).toHaveText("FAKE-P-00006");
  await expect(page.getByRole("button", { name: "Approve" })).toBeVisible();
  // Escalating is for analysts, and the case is already assigned.
  await expect(page.getByRole("button", { name: "Escalate" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Claim" })).toHaveCount(0);

  await page.getByRole("button", { name: "Reject" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Note is required.")).toBeVisible();
  await page.getByLabel("Note").fill("Names differ and cannot be explained");
  await page.getByRole("button", { name: "Confirm" }).click();

  await expect(field(page, "Status")).toHaveText("rejected");
  await expect(field(page, "Decided by")).toHaveText("noor@example.test");
  await expect(field(page, "Notes")).toContainText("Names differ and cannot be explained");
  await expect(page.getByRole("button", { name: "Reject" })).toHaveCount(0);
});

test("Lee gets a 403 from the approve action on Kim's case, and no button for a high-risk case", async ({
  browser,
  request,
}) => {
  // Kim approves case_003, which is assigned to Kim. This is the request Lee will replay.
  const kimContext = await browser.newContext();
  const kim = await kimContext.newPage();
  await loginAs(kim, "kim@example.test");
  await kim.goto("/kyc/case_003");
  await kim.getByRole("button", { name: "Approve" }).click();
  const approveRequest = kim.waitForRequest(
    (sent) => sent.method() === "POST" && "next-action" in sent.headers(),
  );
  await kim.getByRole("button", { name: "Confirm" }).click();
  const approve = await approveRequest;
  await expect(field(kim, "Status")).toHaveText("approved");
  await kimContext.close();

  // Back to fresh data: case_003 is open again and still assigned to Kim.
  await request.post(`${IDENTITY_SERVICE_URL}/__reset`);

  const leeContext = await browser.newContext();
  const lee = await leeContext.newPage();
  await loginAs(lee, "lee@example.test");
  await lee.goto("/kyc/case_003");
  await expect(field(lee, "Status")).toHaveText("open");
  await expect(field(lee, "ID number (masked)")).toHaveText("••••0003");
  expect(await lee.content()).not.toContain("FAKE-N-00003");
  for (const name of ["Claim", "Approve", "Reject", "Escalate"]) {
    await expect(lee.getByRole("button", { name })).toHaveCount(0);
  }

  // Lee sends the same approve action straight to the server, without the button.
  const direct = await lee.request.post(approve.url(), {
    headers: {
      "next-action": approve.headers()["next-action"],
      "content-type": approve.headers()["content-type"],
      accept: "text/x-component",
    },
    data: approve.postData() ?? "",
  });
  expect(direct.status()).toBe(403);
  await lee.reload();
  await expect(field(lee, "Status")).toHaveText("open");
  await expect(field(lee, "Decided by")).toHaveText("Not decided yet");

  // case_006 is Lee's, but its risk score of 81 is over the analyst limit.
  await lee.goto("/kyc/case_006");
  await expect(field(lee, "ID number")).toHaveText("FAKE-P-00006");
  await expect(lee.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(lee.getByRole("button", { name: "Reject" })).toBeVisible();
  await expect(lee.getByRole("button", { name: "Escalate" })).toBeVisible();

  await leeContext.close();
});

test("the service's refusal is shown on the page", async ({ page, request }) => {
  await loginAs(page, "kim@example.test");
  // case_003 is assigned to Kim.
  await page.goto("/kyc/case_003");
  await page.getByRole("button", { name: "Approve" }).click();

  // A lead decides the case while Kim's dialog is open.
  await request.post(`${IDENTITY_SERVICE_URL}/cases/case_003/decision`, {
    data: { decision: "reject", by: "noor@example.test" },
  });
  await page.getByRole("button", { name: "Confirm" }).click();

  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "Case case_003 is already rejected",
  );
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.reload();
  await expect(field(page, "Status")).toHaveText("rejected");
  await expect(field(page, "Decided by")).toHaveText("noor@example.test");
});

test("the list filters by status", async ({ page }) => {
  await loginAs(page, "noor@example.test");
  await page.goto("/kyc");
  await expect(page.locator("tbody tr")).toHaveCount(15);

  await page.getByRole("combobox", { name: "Status" }).click();
  await page.getByRole("option", { name: "Escalated" }).click();
  await expect(page).toHaveURL(/\/kyc\?status=escalated$/);
  const statuses = page.locator("tbody tr td:nth-child(5)");
  await expect(statuses).toHaveCount(2);
  for (const status of await statuses.allTextContents()) expect(status).toBe("escalated");
});
