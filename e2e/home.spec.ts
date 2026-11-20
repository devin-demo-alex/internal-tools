import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test("home page loads", async ({ page }) => {
  await loginAs(page, "sam@example.test");
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Internal tools" }),
  ).toBeVisible();
});
