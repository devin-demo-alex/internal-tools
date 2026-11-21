import { expect, test } from "vitest";
import { startPaymentsService } from "./helpers";

const { pageExists } = await import("@/app/refunds/page-exists");
const { getApp, pageExists: platformPageExists } = await import("@/platform/registry");

startPaymentsService();

test("only a refund page for a refund that does not exist is missing", async () => {
  expect(await pageExists("/refunds")).toBe(true);
  expect(await pageExists("/refunds/ref_001")).toBe(true);
  expect(await pageExists("/refunds/ref_999999")).toBe(false);
});

test("the platform asks the app, and an app with no check has no missing pages", async () => {
  expect(await platformPageExists(getApp("refunds")!, "/refunds/ref_999999")).toBe(false);
  expect(await platformPageExists(getApp("refunds")!, "/refunds/ref_001")).toBe(true);
  expect(await platformPageExists(getApp("admin")!, "/admin/anything")).toBe(true);
});
