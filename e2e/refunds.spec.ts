import { expect, test, type Page } from "@playwright/test";
import { loginAs } from "./helpers";

// The fake payments service keeps its data while it runs, so each test makes
// its own refund request with a reason no other test uses.
function uniqueReason(label: string): string {
  return `${label} ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

async function fillNewRefund(page: Page, payment: RegExp, amount: string, reason: string) {
  await page.goto("/refunds");
  await page.getByRole("button", { name: "New refund request" }).click();
  await page.getByRole("combobox", { name: "Payment" }).click();
  await page.getByRole("option", { name: payment }).click();
  await page.getByLabel("Refund amount").fill(amount);
  await page.getByLabel("Reason").fill(reason);
  await page.getByRole("button", { name: "Send request" }).click();
}

test("Sam creates a request, Ravi approves it, and Sam gets a 403 from the approve action", async ({ browser }) => {
  const reason = uniqueReason("Duplicate charge");

  // Sam creates the request.
  const samContext = await browser.newContext();
  const sam = await samContext.newPage();
  await loginAs(sam, "sam@example.test");
  await fillNewRefund(sam, /pay_012/, "12.50", reason);
  const row = sam.getByRole("row").filter({ hasText: reason });
  await expect(row).toContainText("Lorcan Pebblebrook");
  await expect(row).toContainText("$1,200.00");
  await expect(row).toContainText("$12.50");
  await expect(row).toContainText("requested");
  await expect(row).toContainText("sam@example.test");

  // Sam may not decide on it, so the page shows Sam no buttons.
  await row.getByRole("link").click();
  await expect(sam.getByRole("heading", { name: /^Refund ref_/ })).toBeVisible();
  const refundUrl = sam.url();
  await expect(sam.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(sam.getByRole("button", { name: "Reject" })).toHaveCount(0);

  // Ravi approves it.
  const raviContext = await browser.newContext();
  const ravi = await raviContext.newPage();
  await loginAs(ravi, "ravi@example.test");
  await ravi.goto(refundUrl);
  await expect(ravi.getByText("Lorcan Pebblebrook")).toBeVisible();
  await ravi.getByRole("button", { name: "Approve" }).click();
  const approveRequest = ravi.waitForRequest(
    (request) => request.method() === "POST" && "next-action" in request.headers(),
  );
  await ravi.getByRole("button", { name: "Confirm" }).click();
  const approve = await approveRequest;
  await expect(ravi.getByText("approved", { exact: true })).toBeVisible();
  await expect(ravi.getByText("ravi@example.test")).toBeVisible();
  await expect(ravi.getByRole("button", { name: "Approve" })).toHaveCount(0);

  // Sam sends the same approve action straight to the server, without the button.
  const direct = await sam.request.post(approve.url(), {
    headers: {
      "next-action": approve.headers()["next-action"],
      "content-type": approve.headers()["content-type"],
      accept: "text/x-component",
    },
    data: approve.postData() ?? "",
  });
  expect(direct.status()).toBe(403);

  await sam.reload();
  await expect(sam.getByText("ravi@example.test")).toBeVisible();

  await samContext.close();
  await raviContext.close();
});

test("a request for more than the payment amount shows the service's error", async ({ page }) => {
  const reason = uniqueReason("Too much");
  await loginAs(page, "sam@example.test");
  // pay_009 is a payment of £6.00.
  await fillNewRefund(page, /pay_009/, "6.01", reason);

  await expect(page.getByRole("form", { name: "New refund request" }).getByRole("alert")).toContainText(
    "Refund of 601 exceeds the refundable amount of 600 on payment pay_009",
  );
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText(reason)).toHaveCount(0);
});

test("the list filters by status", async ({ page }) => {
  await loginAs(page, "ravi@example.test");
  await page.goto("/refunds");
  await expect(page.getByRole("button", { name: "New refund request" })).toHaveCount(0);

  await page.getByRole("combobox", { name: "Status" }).click();
  await page.getByRole("option", { name: "Rejected" }).click();
  await expect(page).toHaveURL(/\/refunds\?status=rejected$/);
  const statuses = page.locator("tbody tr td:nth-child(6)");
  await expect(statuses.first()).toHaveText("rejected");
  for (const status of await statuses.allTextContents()) expect(status).toBe("rejected");
});

test("Ravi rejects a request with a note", async ({ browser, page }) => {
  const reason = uniqueReason("Late delivery");
  const samContext = await browser.newContext();
  const sam = await samContext.newPage();
  await loginAs(sam, "sam@example.test");
  await fillNewRefund(sam, /pay_011/, "1.00", reason);
  const href = await sam.getByRole("row").filter({ hasText: reason }).getByRole("link").getAttribute("href");
  await samContext.close();

  await loginAs(page, "ravi@example.test");
  await page.goto(href!);
  await page.getByRole("button", { name: "Reject" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByText("Note is required.")).toBeVisible();
  await page.getByLabel("Note").fill("Outside the return window");
  await page.getByRole("button", { name: "Confirm" }).click();

  await expect(page.getByText("rejected", { exact: true })).toBeVisible();
  await expect(page.getByText("Outside the return window")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reject" })).toHaveCount(0);
});

test("a refund that does not exist gets a real 404 status, and the other statuses are unchanged", async ({ page, browser }) => {
  await loginAs(page, "ravi@example.test");

  const missing = await page.request.get("/refunds/ref_999999", { maxRedirects: 0 });
  expect(missing.status()).toBe(404);
  const navigation = await page.goto("/refunds/ref_999999");
  expect(navigation?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "404: Not found" })).toBeVisible();

  // A refund that exists, the list, and an address no page has.
  expect((await page.request.get("/refunds/ref_001")).status()).toBe(200);
  expect((await page.request.get("/refunds")).status()).toBe(200);
  expect((await page.request.get("/refunds/ref_001/nothing-here")).status()).toBe(404);

  // Someone who may not open the app still gets 403, and a signed-out visitor the redirect.
  expect((await page.request.get("/admin", { maxRedirects: 0 })).status()).toBe(403);
  const kimContext = await browser.newContext();
  const kim = await kimContext.newPage();
  await loginAs(kim, "kim@example.test");
  expect((await kim.request.get("/refunds/ref_999999", { maxRedirects: 0 })).status()).toBe(403);
  await kimContext.close();
  const signedOut = await browser.newContext();
  const visitor = await signedOut.request.get("http://localhost:3000/refunds/ref_999999", { maxRedirects: 0 });
  expect(visitor.status()).toBe(307);
  await signedOut.close();
});
