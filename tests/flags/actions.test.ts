import { expect, test } from "vitest";
import type { User } from "@/platform/contracts";
import { startFlagsService } from "./helpers";

process.env.AUDIT_DB_PATH = ":memory:";

const { ForbiddenError } = await import("@/platform/actions");
const { listAudit } = await import("@/platform/audit");
const { listFlags } = await import("@/platform/services/flags");
const { toggleFeatureFlag } = await import("@/app/flags/actions");

startFlagsService();

const eli: User = { name: "Eli Engineer", email: "eli@example.test", groups: ["engineers"] };
const mia: User = {
  name: "Mia Release",
  email: "mia@example.test",
  groups: ["engineers", "release-managers"],
};

// The service's data is reset before each test, so each test uses its own flag
// and audit lookups name the flag and the actor.
async function flag(key: string, environment: string) {
  return (await listFlags()).find((f) => f.key === key && f.environment === environment)!;
}

test("Eli turns a staging flag off: one allowed and one completed entry, with only what changed", async () => {
  // dark-mode-dashboard is on in staging.
  expect(
    await toggleFeatureFlag(eli, { key: "dark-mode-dashboard", environment: "staging", enabled: false }),
  ).toEqual({});

  expect(await flag("dark-mode-dashboard", "staging")).toMatchObject({
    enabled: false,
    updatedBy: "eli@example.test",
  });
  // The production record of the same key is untouched.
  expect(await flag("dark-mode-dashboard", "production")).toMatchObject({
    enabled: false,
    updatedAt: "2026-01-18T08:20:00.000Z",
  });

  const entries = await listAudit({ resourceId: "dark-mode-dashboard:staging", actorEmail: "eli@example.test" });
  expect(entries.map((entry) => entry.outcome).sort()).toEqual(["allowed", "completed"]);
  const allowed = entries.find((entry) => entry.outcome === "allowed");
  const completed = entries.find((entry) => entry.outcome === "completed");
  expect(allowed).toMatchObject({ app: "flags", action: "flags.toggle", resourceType: "flag" });
  // Only the field the permission check needs, and only the field that changed.
  expect(allowed?.before).toEqual({ environment: "staging" });
  expect(completed?.before).toEqual({ enabled: true });
  expect(completed?.after).toEqual({ enabled: false });
});

test("Eli is refused on a production flag: one denied entry and nothing changes", async () => {
  const before = await listFlags();

  await expect(
    toggleFeatureFlag(eli, { key: "refund-auto-approve", environment: "production", enabled: true }),
  ).rejects.toBeInstanceOf(ForbiddenError);

  expect(await listFlags()).toEqual(before);
  const entries = await listAudit({ resourceId: "refund-auto-approve:production", actorEmail: "eli@example.test" });
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({
    app: "flags",
    action: "flags.toggle",
    resourceType: "flag",
    outcome: "denied",
    before: null,
    after: null,
  });
});

test("Mia turns a production flag on", async () => {
  // refund-auto-approve is off in production.
  expect(
    await toggleFeatureFlag(mia, { key: "refund-auto-approve", environment: "production", enabled: true }),
  ).toEqual({});

  expect(await flag("refund-auto-approve", "production")).toMatchObject({
    enabled: true,
    updatedBy: "mia@example.test",
  });
  const [completed, allowed, ...rest] = await listAudit({
    resourceId: "refund-auto-approve:production",
    actorEmail: "mia@example.test",
  });
  expect(rest).toEqual([]);
  expect(allowed.outcome).toBe("allowed");
  expect(completed).toMatchObject({
    outcome: "completed",
    before: { enabled: false },
    after: { enabled: true },
  });
});

test("a flag the service does not know returns the service's error", async () => {
  const before = await listFlags();

  const outcome = await toggleFeatureFlag(eli, { key: "no-such-flag", environment: "staging", enabled: true });

  expect(outcome).toEqual({ error: "Flag no-such-flag not found in staging" });
  expect(await listFlags()).toEqual(before);
  const [failed, allowed, ...rest] = await listAudit({
    resourceId: "no-such-flag:staging",
    actorEmail: "eli@example.test",
  });
  expect(rest).toEqual([]);
  expect(allowed.outcome).toBe("allowed");
  expect(failed).toMatchObject({ outcome: "failed", after: { error: outcome.error } });
});
