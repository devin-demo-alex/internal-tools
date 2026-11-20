import { expect, type Page } from "@playwright/test";

/** Signs in as a test user through the login page. */
export async function loginAs(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.getByRole("button", { name: email }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(page.getByRole("heading", { name: "Internal tools" })).toBeVisible();
}
