import { expect, test } from "@playwright/test";
import { createRunAction } from "../src/platform/actions/run-action";
import { recordAudit } from "../src/platform/audit";
import { listPeople } from "../src/platform/directory";
import { apps } from "../src/platform/registry";
import { loginAs } from "./helpers";

const ADMIN_PAGES = ["/admin/apps", "/admin/roles", "/admin/people", "/admin/audit"];
const ADA = "ada@example.test";

for (const person of listPeople().filter((person) => person.email !== ADA)) {
  test(`${person.name} gets a 403 on every admin page`, async ({ page }) => {
    await loginAs(page, person.email);
    for (const path of ADMIN_PAGES) {
      const response = await page.request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(403);
      const body = await response.text();
      expect(body, path).toContain("403: Not allowed");
      expect(body, path).not.toContain("Admin centre");

      const navigation = await page.goto(path);
      expect(navigation?.status(), path).toBe(403);
      await expect(page.getByRole("heading", { name: "403: Not allowed" })).toBeVisible();
    }
  });
}

test("a visitor who is not signed in is sent to the login page", async ({ request }) => {
  for (const path of ADMIN_PAGES) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(307);
    expect(response.headers()["location"], path).toMatch(/\/login$/);
  }
});

test("Ada reaches every admin page from the admin menu", async ({ page }) => {
  await loginAs(page, ADA);
  await page.goto("/admin");
  const menu = page.getByRole("navigation", { name: "Admin centre" });
  for (const [link, path, heading] of [
    ["Apps", "/admin/apps", "Apps"],
    ["Roles", "/admin/roles", "Roles"],
    ["People", "/admin/people", "People"],
    ["Audit log", "/admin/audit", "Audit log"],
  ]) {
    await menu.getByRole("link", { name: link, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("heading", { level: 1, name: heading, exact: true })).toBeVisible();
  }
});

test("Ada sees the four admin pages on the landing page and each link opens", async ({ page }) => {
  await loginAs(page, ADA);
  const navigation = await page.goto("/admin");
  expect(navigation?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1, name: "Admin centre", exact: true })).toBeVisible();
  await expect(page.getByText("Not built yet")).toHaveCount(0);

  const pages = page.getByRole("list", { name: "Admin pages" });
  await expect(pages.getByRole("link")).toHaveText(["Apps", "Roles", "People", "Audit log"]);
  // Each link has one line saying what the page shows.
  for (const item of await pages.getByRole("listitem").all()) {
    await expect(item.getByRole("paragraph")).not.toBeEmpty();
  }

  for (const [link, path, heading] of [
    ["Apps", "/admin/apps", "Apps"],
    ["Roles", "/admin/roles", "Roles"],
    ["People", "/admin/people", "People"],
    ["Audit log", "/admin/audit", "Audit log"],
  ]) {
    await page.goto("/admin");
    await pages.getByRole("link", { name: link, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("heading", { level: 1, name: heading, exact: true })).toBeVisible();
  }
});

test("Sam gets a 403 on the admin landing page", async ({ page }) => {
  await loginAs(page, "sam@example.test");
  const response = await page.request.get("/admin", { maxRedirects: 0 });
  expect(response.status()).toBe(403);
  const body = await response.text();
  expect(body).toContain("403: Not allowed");
  expect(body).not.toContain("Admin centre");

  const navigation = await page.goto("/admin");
  expect(navigation?.status()).toBe(403);
  await expect(page.getByRole("heading", { name: "403: Not allowed" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Admin pages" })).toHaveCount(0);
});

test("the apps page lists every app in the registry", async ({ page }) => {
  await loginAs(page, ADA);
  await page.goto("/admin/apps");
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(apps.length);
  for (const [index, app] of apps.entries()) {
    const cells = rows.nth(index).locator("td");
    await expect(cells.nth(0)).toHaveText(app.name);
    await expect(cells.nth(1)).toHaveText(app.description);
    await expect(cells.nth(2)).toHaveText(app.path);
    for (const group of app.openGroups) {
      await expect(cells.nth(3)).toContainText(group);
    }
  }
});

test("the roles page shows a section for each app", async ({ page }) => {
  await loginAs(page, ADA);
  await page.goto("/admin/roles");
  for (const app of apps) {
    await expect(page.getByRole("region", { name: app.name, exact: true })).toBeVisible();
  }
  // The admin centre is read-only, so its own permissions stay empty.
  await expect(
    page.getByRole("region", { name: "Admin", exact: true }).getByText("No actions yet"),
  ).toBeVisible();
});

test("the people page lists the test users and says it stands in for Microsoft Entra", async ({ page }) => {
  await loginAs(page, ADA);
  await page.goto("/admin/people");
  await expect(page.getByText("This list stands in for Microsoft Entra.")).toBeVisible();
  const people = listPeople();
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(people.length);
  for (const [index, person] of people.entries()) {
    const cells = rows.nth(index).locator("td");
    await expect(cells.nth(0)).toHaveText(person.name);
    await expect(cells.nth(1)).toHaveText(person.email);
    for (const group of person.groups) {
      await expect(cells.nth(2)).toContainText(group);
    }
  }
});

test("the audit page lists entries written through runAction, filters them and shows before and after", async ({ page }) => {
  // Written to the same audit log the web app reads. The ids are unique per run
  // because the log is append-only.
  const run = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const runAction = createRunAction({
    getPermissions: () => ({ "refund.approve": { groups: ["refund-approvers"] } }),
    recordAudit,
  });
  const [sam, ravi] = ["sam@example.test", "ravi@example.test"].map(
    (email) => listPeople().find((person) => person.email === email)!,
  );
  await runAction(ravi, "refunds", "refund.approve", { type: "refund", id: `${run}-ok` }, () => ({
    before: { status: "requested", amount: 42 },
    after: { status: "approved", amount: 42 },
  }));
  await runAction(sam, "refunds", "refund.approve", { type: "refund", id: `${run}-no` }, () => ({})).catch(() => {});

  await loginAs(page, ADA);
  await page.goto("/admin/audit");
  const rowsFor = (id: string) => page.locator("tbody tr").filter({ hasText: id });

  // Newest first: the denied row, then completed, then allowed.
  await expect(page.locator("tbody tr").filter({ hasText: run }).locator("td:last-child")).toHaveText([
    "denied",
    "completed",
    "allowed",
  ]);

  // Clicking a row shows its before and after values.
  await rowsFor(`${run}-ok`).filter({ hasText: "completed" }).locator("td").nth(3).click();
  const detail = page.getByTestId("audit-detail");
  await expect(detail.getByLabel("Before value")).toContainText('"status": "requested"');
  await expect(detail.getByLabel("After value")).toContainText('"status": "approved"');
  await detail.getByRole("button", { name: "Close" }).click();
  await expect(detail).toHaveCount(0);

  // Filter by person and outcome through the form.
  await page.getByRole("combobox", { name: "Person" }).click();
  await page.getByRole("option", { name: /sam@example\.test/ }).click();
  await page.getByRole("combobox", { name: "Outcome" }).click();
  await page.getByRole("option", { name: "denied" }).click();
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page).toHaveURL(/person=sam%40example\.test/);
  await expect(rowsFor(`${run}-no`)).toHaveCount(1);
  await expect(rowsFor(`${run}-ok`)).toHaveCount(0);
  await expect(page.locator("tbody tr td:nth-child(2)").first()).toHaveText("sam@example.test");

  // Clearing the filters empties the fields as well as the results.
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page).toHaveURL(/\/admin\/audit$/);
  await expect(page.getByRole("combobox", { name: "Person" })).toHaveText("Everyone");
  await expect(page.getByRole("combobox", { name: "Outcome" })).toHaveText("All outcomes");
  await expect(rowsFor(run)).toHaveCount(3);

  // It also resets a choice that was picked but never applied.
  await page.getByRole("combobox", { name: "App" }).click();
  await page.getByRole("option", { name: "Feature flags" }).click();
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page.getByRole("combobox", { name: "App" })).toHaveText("All apps");

  // Filter by app and by date range through the address bar.
  const today = new Date().toISOString().slice(0, 10);
  await page.goto(`/admin/audit?app=refunds&from=${today}&to=${today}`);
  await expect(rowsFor(run)).toHaveCount(3);
  await page.goto("/admin/audit?app=flags");
  await expect(rowsFor(run)).toHaveCount(0);
  await page.goto("/admin/audit?to=2000-01-01");
  await expect(page.getByText("No audit entries match these filters.")).toBeVisible();

  // A bad date shows a message instead of results, and keeps what was typed.
  await page.goto("/admin/audit?from=yesterday");
  await expect(page.getByText("Use a date like 2026-01-31.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "From day" })).toHaveValue("yesterday");
  await expect(page.locator("tbody tr")).toHaveCount(0);
  await page.getByRole("link", { name: "Clear filters" }).click();
  await expect(page.getByRole("textbox", { name: "From day" })).toHaveValue("");
  await expect(rowsFor(run)).toHaveCount(3);
  await page.goto(`/admin/audit?from=${today}&to=2000-01-01`);
  await expect(page.getByText("The last day is before the first day.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "To day" })).toHaveValue("2000-01-01");
  await expect(page.locator("tbody tr")).toHaveCount(0);
});
