import { expect, test } from "@playwright/test";
import { TEST_USERS } from "@/platform/auth/test-users";
import type { AppEntry, User } from "@/platform/contracts";
import { apps } from "@/platform/registry";
import { loginAs } from "./helpers";

// These tests name no real app. Apps and people are read from the registry and the
// directory, so adding an app never needs a change here. What each app's own pages
// show is checked in that app's tests.
const TEST_ONLY_PATH = "/test-only-app";

const opens = (user: User, app: AppEntry) => app.openGroups.some((group) => user.groups.includes(group));
const allowedFor = (user: User) => apps.filter((app) => opens(user, app));
const deniedFor = (user: User) => apps.filter((app) => !opens(user, app));

// Someone with at least one app they may open and one they may not.
const someone = TEST_USERS.find((user) => allowedFor(user).length > 0 && deniedFor(user).length > 0)!;
// Someone else who may open at least one app.
const another = TEST_USERS.find((user) => user.email !== someone.email && allowedFor(user).length > 0)!;
const appPaths = apps.map((app) => app.path);

test("the registry and the directory give these tests something to check", () => {
  expect(apps.length).toBeGreaterThan(1);
  expect(appPaths).not.toContain(TEST_ONLY_PATH);
  expect(someone).toBeDefined();
  expect(another).toBeDefined();
  for (const app of apps) {
    expect(TEST_USERS.some((user) => opens(user, app)), `someone opens ${app.id}`).toBe(true);
    expect(TEST_USERS.some((user) => !opens(user, app)), `someone is refused ${app.id}`).toBe(true);
  }
});

test("a visitor who is not signed in is sent to the login page", async ({ page }) => {
  for (const path of ["/", ...appPaths]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  }
});

for (const user of TEST_USERS) {
  test(`${user.name} sees only the apps their groups open and gets the 403 page elsewhere`, async ({ page }) => {
    const allowed = allowedFor(user);
    await loginAs(page, user.email);

    await expect(page.getByText(user.name).first()).toBeVisible();
    const home = page.getByRole("list", { name: "Your apps" });
    await expect(home.getByRole("link")).toHaveText(allowed.map((app) => app.name));
    await expect(page.getByRole("navigation", { name: "Apps" }).getByRole("link")).toHaveText(
      allowed.map((app) => app.name),
    );
    for (const app of deniedFor(user)) {
      await expect(page.getByRole("link", { name: app.name, exact: true })).toHaveCount(0);
    }

    for (const app of allowed) {
      await page.goto("/");
      await home.getByRole("link", { name: app.name, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`${app.path}$`));
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expect(page.getByRole("heading", { name: "403: Not allowed" })).toHaveCount(0);
      expect((await page.request.get(app.path, { maxRedirects: 0 })).status(), app.path).toBe(200);
    }

    for (const app of deniedFor(user)) {
      const navigation = await page.goto(app.path);
      expect(navigation?.status(), app.path).toBe(403);
      await expect(page.getByRole("heading", { name: "403: Not allowed" })).toBeVisible();
      await expect(page.getByText("Not built yet")).toHaveCount(0);
    }
  });
}

test("a path that belongs to no app gets a real 404 status, for every signed-in user", async ({ page }) => {
  for (const user of [someone, another]) {
    await loginAs(page, user.email);
    const response = await page.request.get(TEST_ONLY_PATH, { maxRedirects: 0 });
    expect(response.status(), user.email).toBe(404);
    const navigation = await page.goto(`${TEST_ONLY_PATH}/anything`);
    expect(navigation?.status(), user.email).toBe(404);
  }
});

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
  for (const path of ["/", ...appPaths, TEST_ONLY_PATH, "/ui-preview"]) {
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
  await loginAs(page, someone.email);

  for (const app of allowedFor(someone)) {
    const allowed = await page.request.get(app.path, { maxRedirects: 0 });
    expect(allowed.status(), app.path).toBe(200);
  }

  for (const { path } of deniedFor(someone)) {
    const response = await page.request.get(path, { maxRedirects: 0 });
    expect(response.status(), path).toBe(403);
    expect(await response.text(), path).not.toContain("Not built yet");

    const navigation = await page.goto(path);
    expect(navigation?.status(), path).toBe(403);
    await expect(page.getByRole("heading", { name: "403: Not allowed" })).toBeVisible();
  }
});

test("after signing out nothing of the previous user is shown, and the next user gets their own frame", async ({ page }) => {
  await loginAs(page, "sam@example.test");
  await expect(page.getByRole("banner")).toContainText("Sam Agent");
  await expect(page.getByRole("navigation", { name: "Apps" })).toBeVisible();

  // Record every frame or user name that appears on the login page, however briefly.
  await page.addInitScript(() => {
    const seen = new Set<string>();
    Object.assign(window, { __seenOnLogin: seen });
    const look = () => {
      if (location.pathname !== "/login") return;
      if (document.querySelector("header")) seen.add("frame header");
      if (document.querySelector('nav[aria-label="Apps"]')) seen.add("app menu");
      if (document.querySelector('a[href="/logout"]')) seen.add("sign-out link");
    };
    new MutationObserver(look).observe(document, { childList: true, subtree: true });
    document.addEventListener("DOMContentLoaded", look);
  });

  await page.getByRole("link", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.waitForLoadState("networkidle");
  expect(await page.evaluate(() => [...(window as unknown as { __seenOnLogin: Set<string> }).__seenOnLogin])).toEqual([]);
  await expect(page.getByRole("banner")).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "Apps" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Sign out" })).toHaveCount(0);
  // The only names on the page are the sign-in buttons.
  await expect(page.getByText("Sam Agent")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "sam@example.test" })).toBeVisible();

  await page.getByRole("button", { name: "ravi@example.test" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByRole("banner")).toContainText("Ravi Approver");
  await expect(page.getByRole("banner")).not.toContainText("Sam Agent");
  await expect(page.getByRole("navigation", { name: "Apps" }).getByRole("link")).toHaveText(
    allowedFor(TEST_USERS.find((user) => user.email === "ravi@example.test")!).map((app) => app.name),
  );
});

test("the login page never shows the frame: a signed-in visitor is sent home", async ({ page }) => {
  await loginAs(page, "sam@example.test");
  const response = await page.request.get("/login", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(new URL(response.headers()["location"], "http://localhost:3000").pathname).toBe("/");
  await page.goto("/login");
  await expect(page).toHaveURL(/:3000\/$/);
});

test("loginAs switches users on a page where someone is already signed in", async ({ page }) => {
  await loginAs(page, "sam@example.test");
  await expect(page.getByRole("banner")).toContainText("Sam Agent");

  await loginAs(page, "ravi@example.test");
  await expect(page.getByRole("banner")).toContainText("Ravi Approver");
  await expect(page.getByRole("banner")).not.toContainText("Sam Agent");

  await loginAs(page, "ada@example.test");
  await expect(page.getByRole("banner")).toContainText("Ada Admin");
  expect((await page.request.get("/admin", { maxRedirects: 0 })).status()).toBe(200);
});
