import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

const APP_NAMES = ["Refunds", "KYC review", "Feature flags", "Admin"];

const cases = [
  { email: "sam@example.test", name: "Sam Agent", app: "Refunds", path: "/refunds", denied: ["/kyc", "/flags", "/admin"] },
  { email: "noor@example.test", name: "Noor Lead", app: "KYC review", path: "/kyc", denied: ["/refunds", "/flags", "/admin"] },
  { email: "mia@example.test", name: "Mia Release", app: "Feature flags", path: "/flags", denied: ["/refunds", "/kyc", "/admin"] },
  { email: "ada@example.test", name: "Ada Admin", app: "Admin", path: "/admin", denied: ["/refunds", "/kyc", "/flags"] },
];

test("a visitor who is not signed in is sent to the login page", async ({ page }) => {
  for (const path of ["/", "/refunds", "/admin"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  }
});

for (const user of cases) {
  test(`${user.name} sees only ${user.app} and gets the 403 page elsewhere`, async ({ page }) => {
    await loginAs(page, user.email);

    await expect(page.getByText(user.name).first()).toBeVisible();
    const home = page.getByRole("list", { name: "Your apps" });
    await expect(home.getByRole("link")).toHaveText([user.app]);
    for (const name of APP_NAMES.filter((name) => name !== user.app)) {
      await expect(page.getByRole("link", { name, exact: true })).toHaveCount(0);
    }

    await home.getByRole("link", { name: user.app }).click();
    await expect(page).toHaveURL(new RegExp(`${user.path}$`));
    if (user.app === "Refunds") {
      await expect(page.getByRole("heading", { name: "Refunds", exact: true })).toBeVisible();
    } else if (user.app === "Feature flags") {
      await expect(page.getByRole("heading", { name: "Feature flags", exact: true })).toBeVisible();
    } else {
      await expect(page.getByText("Not built yet")).toBeVisible();
    }

    for (const path of user.denied) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "403: Not allowed" })).toBeVisible();
      await expect(page.getByText("Not built yet")).toHaveCount(0);
    }
  });
}

test("the session cookie is http-only and a forged one is ignored", async ({ page, context }) => {
  await loginAs(page, "sam@example.test");
  const cookie = (await context.cookies()).find((c) => c.name === "it_session");
  expect(cookie?.httpOnly).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain("it_session");

  const forged = Buffer.from(
    JSON.stringify({ email: "ada@example.test", exp: Date.now() + 60_000 }),
  ).toString("base64url");
  await context.clearCookies();
  await context.addCookies([
    { name: "it_session", value: `${forged}.${cookie!.value.split(".")[1]}`, url: "http://localhost:3000" },
  ]);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
});

test("logging out ends the session", async ({ page }) => {
  await loginAs(page, "sam@example.test");
  await page.goto("/logout");
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("a signed-out request gets a real redirect status", async ({ request }) => {
  for (const path of ["/", "/refunds", "/admin", "/ui-preview"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(307);
    expect(response.headers()["location"], path).toMatch(/\/login$/);
    expect(await response.text(), path).not.toContain("Not built yet");
  }
});

test("a forged session cookie gets the redirect, not the page", async ({ request }) => {
  const forged = Buffer.from(
    JSON.stringify({ email: "ada@example.test", exp: Date.now() + 60_000 }),
  ).toString("base64url");
  const response = await request.get("/admin", {
    maxRedirects: 0,
    headers: { cookie: `it_session=${forged}.not-a-signature` },
  });
  expect(response.status()).toBe(307);
});

test("an app the user may not open gets a real 403 status", async ({ page }) => {
  await loginAs(page, "sam@example.test");

  const allowed = await page.request.get("/refunds", { maxRedirects: 0 });
  expect(allowed.status()).toBe(200);

  for (const path of ["/kyc", "/flags", "/admin"]) {
    const response = await page.request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(403);
    expect(await response.text(), path).not.toContain("Not built yet");

    const navigation = await page.goto(path);
    expect(navigation?.status(), path).toBe(403);
    await expect(page.getByRole("heading", { name: "403: Not allowed" })).toBeVisible();
  }
});
