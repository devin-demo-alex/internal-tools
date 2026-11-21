import { expect, test } from "vitest";
import type { User } from "@/platform/contracts";
import type { Flag } from "@/platform/services/flags";
import type { IdentityCase } from "@/platform/services/identity";
import type { Refund } from "@/platform/services/payments";
import { buildFlagsService } from "../../mock-services/src/flags";
import { buildIdentityService } from "../../mock-services/src/identity";
import { buildPaymentsService } from "../../mock-services/src/payments";

process.env.AUDIT_DB_PATH = ":memory:";
delete process.env.DEMO_SEED;

const { listAudit, recordAudit } = await import("@/platform/audit");
const { getAuditDb } = await import("@/platform/audit/db");
const { seedDemoAudit, seedDemoAuditIfEnabled } = await import("@/platform/audit/seed-demo");
const { listPeople } = await import("@/platform/directory");
const { authorize } = await import("@/platform/policy");
const { getPermissions } = await import("@/platform/registry");

const NOW = new Date("2026-06-15T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

/** Every row, oldest first. */
async function allRows() {
  return (await listAudit({ limit: 1000 })).reverse();
}

/** What a mock service starts with. */
async function startingData<T>(service: { inject: (path: string) => Promise<{ json: () => unknown }> }, path: string) {
  return (await service.inject(path)).json() as T[];
}

test("with DEMO_SEED unset nothing is added", async () => {
  expect(seedDemoAuditIfEnabled()).toBe(0);
  process.env.DEMO_SEED = "false";
  expect(seedDemoAuditIfEnabled()).toBe(0);
  expect(await allRows()).toHaveLength(0);
});

test("with DEMO_SEED=true an empty log gets about 60 rows, and only once", async () => {
  process.env.DEMO_SEED = "true";
  const added = seedDemoAuditIfEnabled();
  expect(added).toBeGreaterThanOrEqual(55);
  expect(added).toBeLessThanOrEqual(70);
  expect(await allRows()).toHaveLength(added);

  expect(seedDemoAuditIfEnabled()).toBe(0);
  expect(seedDemoAudit()).toBe(0);
  expect(await allRows()).toHaveLength(added);
  delete process.env.DEMO_SEED;
});

test("a log that already has a row is not seeded", async () => {
  const { sqlite } = getAuditDb();
  const before = (await allRows()).length;
  await recordAudit({
    actorEmail: "sam@example.test",
    app: "refunds",
    action: "refunds.request",
    resourceType: "refund",
    resourceId: "new",
    outcome: "denied",
  });
  expect(seedDemoAudit()).toBe(0);
  expect((await allRows()).length).toBe(before + 1);
  // The triggers still refuse a change to a seeded row.
  expect(() => sqlite.prepare("UPDATE audit_events SET outcome = 'completed' WHERE id = 1").run()).toThrow(/append-only/);
  expect(() => sqlite.prepare("DELETE FROM audit_events WHERE id = 1").run()).toThrow(/append-only/);
});

// The remaining tests read the rows of a fresh seed at a fixed time.
const { buildDemoAuditRows } = await import("@/platform/audit/seed-demo");
const rows = buildDemoAuditRows(NOW);

test("the rows are spread over the last seven days, oldest first", () => {
  const times = rows.map((row) => Date.parse(row.at));
  expect([...times].sort((a, b) => a - b)).toEqual(times);
  expect(Math.min(...times)).toBeGreaterThanOrEqual(Date.parse("2026-06-08T00:00:00.000Z"));
  expect(Math.max(...times)).toBeLessThan(Date.parse("2026-06-15T00:00:00.000Z"));
  const days = new Set(rows.map((row) => row.at.slice(0, 10)));
  expect(days.size).toBe(7);
  // Also true at the very start of a day.
  const early = buildDemoAuditRows(new Date("2026-06-15T00:00:01.000Z"));
  expect(Math.max(...early.map((row) => Date.parse(row.at)))).toBeLessThan(Date.parse("2026-06-15T00:00:01.000Z"));
  expect(Date.parse("2026-06-15T00:00:01.000Z") - Math.min(...early.map((row) => Date.parse(row.at)))).toBeLessThanOrEqual(7 * DAY_MS + 1000);
});

test("the rows cover all three apps, all four outcomes and only the test users", () => {
  expect(new Set(rows.map((row) => row.app))).toEqual(new Set(["refunds", "kyc", "flags"]));
  expect(new Set(rows.map((row) => row.outcome))).toEqual(
    new Set(["allowed", "completed", "denied", "failed"]),
  );
  const emails = listPeople().map((person) => person.email);
  for (const row of rows) expect(emails).toContain(row.actorEmail);
  // Every person can be picked in the audit page's filter and show something.
  expect(new Set(rows.map((row) => row.actorEmail))).toEqual(new Set(emails));
});

test("no row holds an ID number or a date of birth", async () => {
  const cases = await startingData<IdentityCase>(buildIdentityService(), "/cases");
  const text = JSON.stringify(rows);
  expect(text).not.toMatch(/idNumber|dateOfBirth|FAKE-/i);
  for (const kycCase of cases) {
    expect(text).not.toContain(kycCase.idNumber);
    expect(text).not.toContain(kycCase.dateOfBirth);
  }
  // The only dates are the rows' own timestamps.
  const values = JSON.stringify(rows.map((row) => [row.before, row.after]));
  expect(values).not.toMatch(/\d{4}-\d{2}-\d{2}/);
});

test("every row follows the permission rules of its app", () => {
  const people = new Map<string, User>(listPeople().map((person) => [person.email, person]));
  const allowed = rows.filter((row) => row.outcome === "allowed");
  for (const row of allowed) {
    const resource = { type: row.resourceType, id: row.resourceId, ...(row.before as object | null) };
    const decision = authorize(people.get(row.actorEmail), getPermissions(row.app), row.action, resource);
    expect(decision.allowed, `${row.actorEmail} ${row.action} ${row.resourceId}`).toBe(true);
    // An allowed row is followed, one second later, by how the action ended.
    const end = rows.find(
      (other) =>
        other.actorEmail === row.actorEmail &&
        other.action === row.action &&
        Date.parse(other.at) === Date.parse(row.at) + 1000,
    );
    expect(["completed", "failed"], `${row.action} ${row.at}`).toContain(end?.outcome);
  }
  expect(rows.filter((row) => row.outcome === "completed" || row.outcome === "failed")).toHaveLength(allowed.length);
});

test("every row uses an action name and a row shape the apps write", () => {
  for (const [index, row] of rows.entries()) {
    expect(Object.keys(getPermissions(row.app) ?? {}), row.action).toContain(row.action);
    if (row.outcome === "denied") {
      expect([row.before, row.after]).toEqual([null, null]);
    }
    if (row.outcome === "completed" || row.outcome === "failed") {
      // The row just before it is the allowed row of the same action.
      const allowed = rows[index - 1];
      expect(allowed).toMatchObject({
        outcome: "allowed",
        actorEmail: row.actorEmail,
        action: row.action,
        resourceType: row.resourceType,
      });
      expect(allowed.after).toBeNull();
    }
  }
});

test("a few rows record a view of a full ID number, and nothing else about it", () => {
  const views = rows.filter((row) => row.action === "kyc.viewFullId");
  const completed = views.filter((row) => row.outcome === "completed");
  expect(completed.length).toBeGreaterThanOrEqual(3);
  expect(views.filter((row) => row.outcome === "allowed")).toHaveLength(completed.length);
  expect(views).toHaveLength(completed.length * 2);
  for (const row of views) {
    expect(row.resourceType).toBe("kyc-case");
    expect(row.after).toBeNull();
    if (row.outcome === "completed") expect(row.before).toBeNull();
    else expect(Object.keys(row.before as object).sort()).toEqual(["assignedTo", "riskScore", "status"]);
  }
});

test("the denied rows tell the three stories", () => {
  const denied = rows
    .filter((row) => row.outcome === "denied")
    .map((row) => `${row.actorEmail} ${row.action} ${row.resourceId}`);
  expect(denied).toContain("pat@example.test refunds.approve ref_002");
  expect(denied).toContain("lee@example.test kyc.approve case_014");
  expect(denied).toContain("eli@example.test flags.toggle instant-payouts:production");
});

/** The completed row of an action on a resource, if there is one. */
function completed(action: string, resourceId: string) {
  return rows.find(
    (row) => row.outcome === "completed" && row.action === action && row.resourceId === resourceId,
  );
}

test("the refund rows agree with the refunds the payments service starts with", async () => {
  const refunds = await startingData<Refund>(buildPaymentsService(), "/refunds");
  for (const refund of refunds) {
    const request = completed("refunds.request", refund.id);
    expect(request, refund.id).toMatchObject({
      actorEmail: refund.requestedBy,
      after: { id: refund.id, paymentId: refund.paymentId, amount: refund.amountCents, status: "requested" },
    });
    const approve = completed("refunds.approve", refund.id);
    const reject = completed("refunds.reject", refund.id);
    if (refund.status === "requested") {
      expect(approve ?? reject, refund.id).toBeUndefined();
      continue;
    }
    const decision = refund.status === "approved" ? approve : reject;
    expect(refund.status === "approved" ? reject : approve, refund.id).toBeUndefined();
    expect(decision, refund.id).toMatchObject({
      actorEmail: refund.decidedBy,
      after: { status: refund.status },
    });
    expect(Date.parse(decision!.at)).toBeGreaterThan(Date.parse(request!.at));
  }
  // The other way round: no row is about a refund the service does not have.
  const ids = refunds.map((refund) => refund.id);
  for (const row of rows.filter((row) => row.app === "refunds" && row.resourceId !== "new")) {
    expect(ids).toContain(row.resourceId);
  }
});

test("the kyc rows agree with the cases the identity service starts with", async () => {
  const cases = await startingData<IdentityCase>(buildIdentityService(), "/cases");
  const actionFor = { approved: "kyc.approve", rejected: "kyc.reject", escalated: "kyc.escalate" };
  for (const kycCase of cases) {
    const claim = completed("kyc.claim", kycCase.id);
    const decisions = Object.values(actionFor)
      .map((action) => completed(action, kycCase.id))
      .filter((row) => row !== undefined);
    if (kycCase.assignedTo === null) {
      expect(claim, kycCase.id).toBeUndefined();
    } else {
      expect(claim, kycCase.id).toMatchObject({
        actorEmail: kycCase.assignedTo,
        after: { assignedTo: kycCase.assignedTo },
      });
    }
    if (kycCase.status === "open") {
      expect(decisions, kycCase.id).toHaveLength(0);
      continue;
    }
    expect(decisions, kycCase.id).toHaveLength(1);
    expect(decisions[0], kycCase.id).toMatchObject({
      action: actionFor[kycCase.status],
      actorEmail: kycCase.decidedBy,
      after: { status: kycCase.status },
    });
    expect(Date.parse(decisions[0]!.at)).toBeGreaterThan(Date.parse(claim!.at));
  }
  for (const row of rows.filter((row) => row.app === "kyc")) {
    const kycCase = cases.find((candidate) => candidate.id === row.resourceId);
    expect(kycCase, row.resourceId).toBeDefined();
    const state = row.outcome === "allowed" ? (row.before as { riskScore: number }) : undefined;
    if (state) expect(state.riskScore).toBe(kycCase!.riskScore);
  }
});

test("the flag rows agree with the flags the flags service starts with", async () => {
  const flags = await startingData<Flag>(buildFlagsService(), "/flags");
  const toggles = rows.filter((row) => row.action === "flags.toggle");
  for (const row of toggles) {
    expect(flags.map((flag) => `${flag.key}:${flag.environment}`)).toContain(row.resourceId);
  }
  const lastToggle = new Map(
    toggles.filter((row) => row.outcome === "completed").map((row) => [row.resourceId, row]),
  );
  expect(lastToggle.size).toBeGreaterThan(0);
  for (const [id, row] of lastToggle) {
    const flag = flags.find((candidate) => `${candidate.key}:${candidate.environment}` === id)!;
    expect(row, id).toMatchObject({ actorEmail: flag.updatedBy, after: { enabled: flag.enabled } });
  }
});
