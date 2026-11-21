import { expect, test } from "vitest";
import type { AppEntry, User } from "@/platform/contracts";
import { apps, appsFor, canOpenApp, getApp, getPermissions, pageExists } from "@/platform/registry";

// These tests name no real app. They check every registered app the same way,
// and use this test-only entry, which is not registered, for everything else.
const TEST_APP: AppEntry = {
  id: "test-only-app",
  name: "Test-only app",
  path: "/test-only-app",
  description: "Exists only in this test.",
  openGroups: ["test-only-openers", "test-only-others"],
};

const user = (groups: string[]): User => ({
  name: "Test User",
  email: "test@example.test",
  groups,
});

test("the test-only app is not registered", () => {
  expect(apps.map((app) => app.id)).not.toContain(TEST_APP.id);
  expect(getApp(TEST_APP.id)).toBeUndefined();
  expect(getPermissions(TEST_APP.id)).toBeUndefined();
});

test("every registered app has its own id, name and path, and at least one group that opens it", () => {
  expect(apps.length).toBeGreaterThan(0);
  for (const key of ["id", "name", "path"] as const) {
    const values = apps.map((app) => app[key]);
    expect(new Set(values).size, key).toBe(values.length);
  }
  for (const app of apps) {
    expect(app.id, app.id).toMatch(/^[a-z][a-z0-9-]*$/);
    expect(app.path, app.id).toBe(`/${app.id}`);
    expect(app.name.trim(), app.id).not.toBe("");
    expect(app.description.trim(), app.id).not.toBe("");
    expect(app.openGroups.length, app.id).toBeGreaterThan(0);
    expect(getApp(app.id), app.id).toBe(app);
  }
});

test("every registered app has permission rules, each naming at least one group", () => {
  for (const app of apps) {
    const permissions = getPermissions(app.id);
    expect(permissions, app.id).toBeDefined();
    for (const [action, rule] of Object.entries(permissions ?? {})) {
      expect(rule.groups.length, action).toBeGreaterThan(0);
    }
  }
});

test("appsFor returns exactly the apps a user's groups open, in registry order", () => {
  const ids = (groups: string[]) => appsFor(user(groups)).map((app) => app.id);
  const opens = (groups: string[]) =>
    apps.filter((app) => app.openGroups.some((group) => groups.includes(group))).map((app) => app.id);

  for (const app of apps) {
    for (const group of app.openGroups) {
      expect(ids([group]), group).toEqual(opens([group]));
      expect(ids([group]), group).toContain(app.id);
    }
  }
  const everyGroup = apps.flatMap((app) => app.openGroups);
  expect(ids(everyGroup)).toEqual(apps.map((app) => app.id));
  expect(ids(TEST_APP.openGroups)).toEqual([]);
  expect(ids([])).toEqual([]);
  expect(appsFor(null)).toEqual([]);
  expect(appsFor(undefined)).toEqual([]);
});

test("canOpenApp allows a user in any of the app's open groups and refuses everyone else", () => {
  expect(canOpenApp(user(["test-only-openers"]), TEST_APP)).toBe(true);
  expect(canOpenApp(user(["something-else", "test-only-others"]), TEST_APP)).toBe(true);
  expect(canOpenApp(user(["something-else"]), TEST_APP)).toBe(false);
  expect(canOpenApp(user([]), TEST_APP)).toBe(false);
  expect(canOpenApp(null, TEST_APP)).toBe(false);
  expect(canOpenApp(undefined, TEST_APP)).toBe(false);
  expect(canOpenApp(user(["test-only-openers"]), { ...TEST_APP, openGroups: [] })).toBe(false);

  for (const app of apps) {
    expect(canOpenApp(user(TEST_APP.openGroups), app), app.id).toBe(false);
  }
});

test("an app with no page check has no missing pages", async () => {
  expect(await pageExists(TEST_APP, TEST_APP.path)).toBe(true);
  expect(await pageExists(TEST_APP, `${TEST_APP.path}/no-such-thing`)).toBe(true);
});
