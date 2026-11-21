import { expect, test } from "vitest";
import type { User } from "@/platform/contracts";
import { apps, appsFor, getPermissions } from "@/platform/registry";

const user = (groups: string[]): User => ({
  name: "Test User",
  email: "test@example.test",
  groups,
});

test("registers the four apps with their open groups", () => {
  expect(apps.map((app) => [app.id, app.path, app.openGroups])).toEqual([
    ["refunds", "/refunds", ["support-agents", "refund-approvers"]],
    ["kyc", "/kyc", ["kyc-analysts", "kyc-leads"]],
    ["flags", "/flags", ["engineers", "release-managers"]],
    ["admin", "/admin", ["platform-admins"]],
  ]);
});

test("appsFor returns only the apps a user's groups open", () => {
  const ids = (groups: string[]) => appsFor(user(groups)).map((app) => app.id);
  expect(ids(["support-agents"])).toEqual(["refunds"]);
  expect(ids(["refund-approvers"])).toEqual(["refunds"]);
  expect(ids(["kyc-leads"])).toEqual(["kyc"]);
  expect(ids(["engineers", "release-managers"])).toEqual(["flags"]);
  expect(ids(["platform-admins"])).toEqual(["admin"]);
  expect(ids([])).toEqual([]);
  expect(appsFor(null)).toEqual([]);
});

test("getPermissions knows registered apps only", () => {
  expect(Object.keys(getPermissions("kyc") ?? {}).sort()).toEqual([
    "kyc.approve",
    "kyc.claim",
    "kyc.escalate",
    "kyc.reject",
    "kyc.view",
    "kyc.viewFullId",
  ]);
  expect(getPermissions("payroll")).toBeUndefined();
});
