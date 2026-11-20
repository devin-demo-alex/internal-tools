import { expect, test, type Page } from "@playwright/test";
import { loginAs } from "./helpers";

// The fake flags service keeps its data while it runs, so each test toggles a
// flag no other test toggles, and reads which way it is set before it starts.
function flagRow(page: Page, key: string, environment: string) {
  return page.getByRole("row").filter({ hasText: key }).filter({ hasText: environment });
}

async function toggle(page: Page, key: string, environment: string) {
  const row = flagRow(page, key, environment);
  const wasOn = (await row.getByRole("cell").nth(3).textContent()) === "on";
  await row.getByRole("button", { name: wasOn ? "Turn off" : "Turn on" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    `This turns ${key} ${wasOn ? "off" : "on"} in ${environment}.`,
  );
  const request = page.waitForRequest(
    (request) => request.method() === "POST" && "next-action" in request.headers(),
  );
  await page.getByRole("button", { name: "Confirm" }).click();
  const sent = await request;
  await expect(row.getByRole("cell").nth(3)).toHaveText(wasOn ? "off" : "on");
  await expect(row.getByRole("button", { name: wasOn ? "Turn on" : "Turn off" })).toBeVisible();
  return sent;
}

test("Eli toggles a staging flag and has no button on production flags", async ({ page }) => {
  await loginAs(page, "eli@example.test");
  await page.goto("/flags");
  await expect(page.getByRole("heading", { name: "Feature flags" })).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(9);

  await toggle(page, "dark-mode-dashboard", "staging");
  await expect(flagRow(page, "dark-mode-dashboard", "staging")).toContainText("eli@example.test");

  // Eli is not a release-manager, so no production row has a button.
  const production = page.getByRole("row").filter({ hasText: "production" });
  await expect(production).toHaveCount(4);
  await expect(production.getByRole("button")).toHaveCount(0);
});

test("Mia toggles a production flag, and Eli gets a 403 from the same action", async ({ browser }) => {
  const miaContext = await browser.newContext();
  const mia = await miaContext.newPage();
  await loginAs(mia, "mia@example.test");
  await mia.goto("/flags");
  // Mia is an engineer and a release-manager, so every row has a button.
  await expect(mia.getByRole("row").getByRole("button", { name: /^Turn (on|off)$/ })).toHaveCount(8);

  const sent = await toggle(mia, "new-onboarding-flow", "production");
  const row = flagRow(mia, "new-onboarding-flow", "production");
  await expect(row).toContainText("mia@example.test");
  const changed = await row.textContent();

  // Eli sends the same toggle action straight to the server, without the button.
  const eliContext = await browser.newContext();
  const eli = await eliContext.newPage();
  await loginAs(eli, "eli@example.test");
  const direct = await eli.request.post(sent.url(), {
    headers: {
      "next-action": sent.headers()["next-action"],
      "content-type": sent.headers()["content-type"],
      accept: "text/x-component",
    },
    data: sent.postData() ?? "",
  });
  expect(direct.status()).toBe(403);

  // Nothing changed: the flag still says Mia changed it, at the same time.
  await mia.reload();
  await expect(row).toHaveText(changed!);

  await miaContext.close();
  await eliContext.close();
});

test("the list filters by environment", async ({ page }) => {
  await loginAs(page, "mia@example.test");
  await page.goto("/flags");

  await page.getByRole("combobox", { name: "Environment" }).click();
  await page.getByRole("option", { name: "Staging" }).click();
  await expect(page).toHaveURL(/\/flags\?environment=staging$/);
  const environments = page.locator("tbody tr td:nth-child(3)");
  await expect(environments).toHaveCount(4);
  for (const environment of await environments.allTextContents()) expect(environment).toBe("staging");
});
