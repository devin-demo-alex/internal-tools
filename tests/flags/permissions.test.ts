import { describe, expect, test } from "vitest";
import { TEST_USERS } from "@/platform/auth/test-users";
import type { User } from "@/platform/contracts";
import { can } from "@/platform/policy";
import type { FlagEnvironment } from "@/platform/services/flags";
import { startFlagsService } from "./helpers";

process.env.AUDIT_DB_PATH = ":memory:";

const { ForbiddenError } = await import("@/platform/actions");
const { listAudit } = await import("@/platform/audit");
const { listFlags } = await import("@/platform/services/flags");
const { toggleFeatureFlag } = await import("@/app/flags/actions");
const { permissions } = await import("@/app/flags/permissions");

startFlagsService();

// instant-payouts in the fake flags service: off in production, on in staging.
const KEY = "instant-payouts";

// Who may do what. Everyone in AGENTS.md who is not listed is refused.
const allowed: Record<string, string[]> = {
  "flags.view": ["eli@example.test", "mia@example.test"],
  "flags.toggle staging": ["eli@example.test", "mia@example.test"],
  "flags.toggle production": ["mia@example.test"],
};

test("the app has exactly these two actions", () => {
  expect(Object.keys(permissions).sort()).toEqual(["flags.toggle", "flags.view"]);
});

describe("flags.view", () => {
  for (const user of TEST_USERS) {
    const expected = allowed["flags.view"].includes(user.email);
    test(`${user.name} is ${expected ? "allowed" : "refused"}`, () => {
      expect(can(user, permissions, "flags.view")).toBe(expected);
    });
  }
});

for (const environment of ["staging", "production"] as FlagEnvironment[]) {
  describe(`flags.toggle, on a ${environment} flag`, () => {
    for (const user of TEST_USERS) {
      const expected = allowed[`flags.toggle ${environment}`].includes(user.email);
      test(`${user.name} is ${expected ? "allowed" : "refused"}`, async () => {
        const before = await listFlags();
        const was = before.find((flag) => flag.key === KEY && flag.environment === environment)!;
        const audit = () =>
          listAudit({
            resourceId: `${KEY}:${environment}`,
            action: "flags.toggle",
            actorEmail: user.email,
          });
        const auditBefore = (await audit()).length;

        const call = toggleFeatureFlag(user, { key: KEY, environment, enabled: !was.enabled });

        if (expected) {
          expect(await call).toEqual({});
          const after = await listFlags();
          expect(
            after.find((flag) => flag.key === KEY && flag.environment === environment),
          ).toMatchObject({ enabled: !was.enabled, updatedBy: user.email });
          // Nothing else changed.
          const others = (flags: typeof before) =>
            flags.filter((flag) => !(flag.key === KEY && flag.environment === environment));
          expect(others(after)).toEqual(others(before));
          const all = await audit();
          const entries = all.slice(0, all.length - auditBefore);
          expect(entries.map((entry) => entry.outcome).sort()).toEqual(["allowed", "completed"]);
        } else {
          await expect(call).rejects.toBeInstanceOf(ForbiddenError);
          expect(await listFlags()).toEqual(before);
          const entries = await audit();
          expect(entries).toHaveLength(auditBefore + 1);
          expect(entries[0]).toMatchObject({
            app: "flags",
            resourceType: "flag",
            outcome: "denied",
            before: null,
            after: null,
          });
        }
      });
    }
  });
}

describe("the environment condition, both ways", () => {
  const engineer: User = { name: "Only Engineer", email: "only-engineer@example.test", groups: ["engineers"] };
  const releaseManager: User = {
    name: "Only Release",
    email: "only-release@example.test",
    groups: ["release-managers"],
  };
  const flag = (environment: string) => ({ id: `${KEY}:${environment}`, environment });

  test("an engineer may toggle staging and not production", () => {
    expect(can(engineer, permissions, "flags.toggle", flag("staging"))).toBe(true);
    expect(can(engineer, permissions, "flags.toggle", flag("production"))).toBe(false);
  });

  test("a release-manager who is not an engineer may toggle production and not staging", () => {
    expect(can(releaseManager, permissions, "flags.toggle", flag("production"))).toBe(true);
    expect(can(releaseManager, permissions, "flags.toggle", flag("staging"))).toBe(false);
  });

  test("an unknown environment, or no flag at all, is refused", () => {
    expect(can(TEST_USERS.find((user) => user.email === "mia@example.test"), permissions, "flags.toggle", flag("qa"))).toBe(false);
    expect(can(engineer, permissions, "flags.toggle")).toBe(false);
  });
});
