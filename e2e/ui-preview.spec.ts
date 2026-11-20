import { expect, test } from "@playwright/test";

test("preview page sorts the table and confirms an action", async ({
  page,
}) => {
  await page.goto("/ui-preview");

  await expect(page.getByText("Sam Agent")).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign out" })).toHaveAttribute(
    "href",
    "/logout",
  );
  await expect(
    page.getByRole("navigation", { name: "Apps" }).getByRole("link"),
  ).toHaveText(["UI preview", "Refunds", "KYC review", "Feature flags"]);

  const table = page.getByRole("table").first();
  const firstColumn = table.locator("tbody tr td:first-child");
  await expect(firstColumn).toHaveText([
    "RF-1003",
    "RF-1001",
    "RF-1004",
    "RF-1002",
  ]);

  const amountHeader = table.getByRole("columnheader", { name: "Amount" });
  await amountHeader.getByRole("button").click();
  await expect(amountHeader).toHaveAttribute("aria-sort", "ascending");
  await expect(firstColumn).toHaveText([
    "RF-1001",
    "RF-1002",
    "RF-1003",
    "RF-1004",
  ]);
  await amountHeader.getByRole("button").click();
  await expect(amountHeader).toHaveAttribute("aria-sort", "descending");
  await expect(firstColumn).toHaveText([
    "RF-1004",
    "RF-1003",
    "RF-1002",
    "RF-1001",
  ]);

  await page.getByLabel("Filter refunds").fill("zzz");
  await expect(table.getByText("No refunds match.")).toBeVisible();
  await page.getByLabel("Filter refunds").fill("birch");
  await expect(firstColumn).toHaveText(["RF-1002"]);

  await page.getByRole("button", { name: "Approve refund" }).click();
  const dialog = page.getByRole("dialog", { name: "Approve refund" });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(dialog.getByText("Reason is required.")).toBeVisible();
  await expect(page.getByTestId("last-action")).toHaveText("No action yet");

  await dialog.getByLabel("Reason").fill("Duplicate charge");
  await dialog.getByRole("button", { name: "Confirm" }).click();
  await expect(dialog.getByRole("button", { name: "Working…" })).toBeDisabled();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("last-action")).toHaveText(
    "Approved refund RF-1003: Duplicate charge",
  );
});
