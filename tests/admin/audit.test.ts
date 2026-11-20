import { afterAll, beforeAll, expect, test, vi } from "vitest";
import type { User } from "@/platform/contracts";
import type { Permissions } from "@/platform/policy";

process.env.AUDIT_DB_PATH = ":memory:";

const { recordAudit } = await import("@/platform/audit");
const { createRunAction } = await import("@/platform/actions/run-action");
const { findAuditEntries, parseAuditFilters } = await import("@/app/admin/audit/query");

const sam: User = { name: "Sam Agent", email: "sam@example.test", groups: ["support-agents"] };
const ravi: User = { name: "Ravi Approver", email: "ravi@example.test", groups: ["refund-approvers"] };
const mia: User = { name: "Mia Release", email: "mia@example.test", groups: ["engineers", "release-managers"] };

const permissions: Record<string, Permissions> = {
  refunds: { "refund.approve": { groups: ["refund-approvers"] } },
  flags: { "flag.toggle": { groups: ["release-managers"] } },
};

const runAction = createRunAction({
  getPermissions: (app) => permissions[app],
  recordAudit,
});

/** What the page shows for each entry, in the order it shows them. */
async function shown(filters: Parameters<typeof findAuditEntries>[0] = {}) {
  return (await findAuditEntries(filters)).map(
    (entry) => `${entry.at.slice(0, 10)} ${entry.actorEmail} ${entry.app} ${entry.resourceId} ${entry.outcome}`,
  );
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });

  // Day 1: Ravi approves a refund (allowed, then completed).
  vi.setSystemTime(new Date("2026-03-01T09:00:00.000Z"));
  await runAction(ravi, "refunds", "refund.approve", { type: "refund", id: "r-1", status: "requested" }, () => ({
    before: { status: "requested" },
    after: { status: "approved" },
  }));

  // Day 2: Sam is refused the same action (denied).
  vi.setSystemTime(new Date("2026-03-02T23:59:59.000Z"));
  await runAction(sam, "refunds", "refund.approve", { type: "refund", id: "r-2" }, () => ({})).catch(() => {});

  // Day 3: Mia's flag change breaks part-way (allowed, then failed).
  vi.setSystemTime(new Date("2026-03-03T00:00:00.000Z"));
  await runAction(mia, "flags", "flag.toggle", { type: "flag", id: "f-1", enabled: false }, () => {
    throw new Error("flags service is down");
  }).catch(() => {});
});

afterAll(() => {
  vi.useRealTimers();
});

test("lists every entry written through runAction, newest first", async () => {
  expect(await shown()).toEqual([
    "2026-03-03 mia@example.test flags f-1 failed",
    "2026-03-03 mia@example.test flags f-1 allowed",
    "2026-03-02 sam@example.test refunds r-2 denied",
    "2026-03-01 ravi@example.test refunds r-1 completed",
    "2026-03-01 ravi@example.test refunds r-1 allowed",
  ]);
});

test("entries carry the before and after values the detail view shows", async () => {
  const [completed] = await findAuditEntries({ outcome: "completed" });
  expect(completed.before).toEqual({ status: "requested" });
  expect(completed.after).toEqual({ status: "approved" });

  const [failed] = await findAuditEntries({ outcome: "failed" });
  expect(failed.after).toEqual({ error: "flags service is down" });
});

test("filters by person", async () => {
  expect(await shown({ person: "sam@example.test" })).toEqual([
    "2026-03-02 sam@example.test refunds r-2 denied",
  ]);
  expect(await shown({ person: "ada@example.test" })).toEqual([]);
});

test("filters by app", async () => {
  expect(await shown({ app: "refunds" })).toEqual([
    "2026-03-02 sam@example.test refunds r-2 denied",
    "2026-03-01 ravi@example.test refunds r-1 completed",
    "2026-03-01 ravi@example.test refunds r-1 allowed",
  ]);
});

test("filters by outcome", async () => {
  expect(await shown({ outcome: "allowed" })).toEqual([
    "2026-03-03 mia@example.test flags f-1 allowed",
    "2026-03-01 ravi@example.test refunds r-1 allowed",
  ]);
  expect(await shown({ outcome: "denied" })).toEqual([
    "2026-03-02 sam@example.test refunds r-2 denied",
  ]);
});

test("filters by date range, including both end days", async () => {
  expect(await shown({ from: "2026-03-02" })).toEqual([
    "2026-03-03 mia@example.test flags f-1 failed",
    "2026-03-03 mia@example.test flags f-1 allowed",
    "2026-03-02 sam@example.test refunds r-2 denied",
  ]);
  expect(await shown({ to: "2026-03-02" })).toEqual([
    "2026-03-02 sam@example.test refunds r-2 denied",
    "2026-03-01 ravi@example.test refunds r-1 completed",
    "2026-03-01 ravi@example.test refunds r-1 allowed",
  ]);
  expect(await shown({ from: "2026-03-02", to: "2026-03-02" })).toEqual([
    "2026-03-02 sam@example.test refunds r-2 denied",
  ]);
  expect(await shown({ from: "2026-03-04" })).toEqual([]);
});

test("filters combine", async () => {
  expect(
    await shown({ person: "ravi@example.test", app: "refunds", outcome: "completed", from: "2026-03-01", to: "2026-03-01" }),
  ).toEqual(["2026-03-01 ravi@example.test refunds r-1 completed"]);
  expect(await shown({ person: "ravi@example.test", app: "flags" })).toEqual([]);
});

test("reads the filters from the query string", () => {
  expect(
    parseAuditFilters({
      person: "sam@example.test",
      app: "refunds",
      outcome: "denied",
      from: "2026-03-01",
      to: "2026-03-02",
    }),
  ).toEqual({
    filters: {
      person: "sam@example.test",
      app: "refunds",
      outcome: "denied",
      from: "2026-03-01",
      to: "2026-03-02",
    },
    errors: {},
  });
});

test("'all', blanks and unknown outcomes do not filter", () => {
  expect(
    parseAuditFilters({ person: "all", app: "", outcome: "deleted", from: " ", to: undefined }),
  ).toEqual({ filters: {}, errors: {} });
});

test("a bad date is reported and not applied", () => {
  expect(parseAuditFilters({ from: "yesterday", to: "2026-02-30" })).toEqual({
    filters: {},
    errors: { from: "Use a date like 2026-01-31.", to: "Use a date like 2026-01-31." },
  });
  expect(parseAuditFilters({ from: "2026-03-05", to: "2026-03-01" })).toEqual({
    filters: { from: "2026-03-05" },
    errors: { to: "The last day is before the first day." },
  });
});
