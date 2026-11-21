import { expect, type Page } from "@playwright/test";

/** Signs in as a test user through the login page. Signs out first if someone is signed in. */
export async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  // A signed-in user is sent home from /login. Signing out lands on the login page.
  if (new URL(page.url()).pathname !== "/login") await page.goto("/logout");
  await page.getByRole("button", { name: email }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByRole("heading", { name: "Internal tools" })).toBeVisible();
}
