import { expect, test } from "vitest";

process.env.AUDIT_DB_PATH = ":memory:";

const { listAudit, recordAudit } = await import("@/platform/audit");
const { getAuditDb } = await import("@/platform/audit/db");

const base = {
  actorEmail: "sam@example.test",
  app: "refunds",
  action: "refund.request",
  resourceType: "refund",
  outcome: "allowed" as const,
};

test("recordAudit stores an entry and listAudit reads it back", async () => {
  const saved = await recordAudit({
    ...base,
    resourceId: "r-read",
    before: { status: "none" },
    after: { status: "requested", amount: 12 },
  });
  expect(saved.id).toBeGreaterThan(0);
  expect(Number.isNaN(Date.parse(saved.at))).toBe(false);

  const found = await listAudit({ resourceId: "r-read" });
  expect(found).toHaveLength(1);
  expect(found[0]).toMatchObject({
    actorEmail: "sam@example.test",
    app: "refunds",
    action: "refund.request",
    resourceType: "refund",
    resourceId: "r-read",
    outcome: "allowed",
    before: { status: "none" },
    after: { status: "requested", amount: 12 },
  });
});

test("listAudit filters and returns newest first", async () => {
  await recordAudit({ ...base, resourceId: "r-filter" });
  await recordAudit({ ...base, resourceId: "r-filter", outcome: "denied" });
  await recordAudit({ ...base, resourceId: "r-other", app: "kyc" });

  const all = await listAudit({ resourceId: "r-filter" });
  expect(all.map((event) => event.outcome)).toEqual(["denied", "allowed"]);
  expect(await listAudit({ resourceId: "r-filter", outcome: "denied" })).toHaveLength(1);
  expect(await listAudit({ app: "kyc" })).toHaveLength(1);
});

test("every outcome is accepted by the database", async () => {
  for (const outcome of ["allowed", "denied", "completed", "failed"] as const) {
    const saved = await recordAudit({ ...base, resourceId: "r-outcomes", outcome });
    expect(saved.outcome).toBe(outcome);
  }
});

test("an outcome outside the known list is rejected by the database", () => {
  const { sqlite } = getAuditDb();
  expect(() =>
    sqlite
      .prepare(
        `INSERT INTO audit_events (at, actor_email, app, action, resource_type, resource_id, outcome)
         VALUES ('2026-01-01T00:00:00.000Z', 'sam@example.test', 'refunds', 'x', 'refund', 'r-bad', 'maybe')`,
      )
      .run(),
  ).toThrow(/CHECK/);
});

test("UPDATE on audit_events fails at the database level", async () => {
  const saved = await recordAudit({ ...base, resourceId: "r-update" });
  const { sqlite } = getAuditDb();

  expect(() =>
    sqlite
      .prepare("UPDATE audit_events SET outcome = 'denied' WHERE id = ?")
      .run(saved.id),
  ).toThrow(/append-only/);

  const [after] = await listAudit({ resourceId: "r-update" });
  expect(after.outcome).toBe("allowed");
});

test("DELETE on audit_events fails at the database level", async () => {
  const saved = await recordAudit({ ...base, resourceId: "r-delete" });
  const { sqlite } = getAuditDb();

  expect(() =>
    sqlite.prepare("DELETE FROM audit_events WHERE id = ?").run(saved.id),
  ).toThrow(/append-only/);
  expect(() => sqlite.prepare("DELETE FROM audit_events").run()).toThrow(
    /append-only/,
  );

  expect(await listAudit({ resourceId: "r-delete" })).toHaveLength(1);
});

const REPLACING_STATEMENTS = {
  "INSERT OR REPLACE": `INSERT OR REPLACE INTO audit_events
    (id, at, actor_email, app, action, resource_type, resource_id, outcome)
    VALUES (?, 'later', 'someone-else@example.test', 'refunds', 'x', 'refund', 'r-replace', 'denied')`,
  "REPLACE INTO": `REPLACE INTO audit_events
    (id, at, actor_email, app, action, resource_type, resource_id, outcome)
    VALUES (?, 'later', 'someone-else@example.test', 'refunds', 'x', 'refund', 'r-replace', 'denied')`,
  "an upsert with ON CONFLICT DO UPDATE": `INSERT INTO audit_events
    (id, at, actor_email, app, action, resource_type, resource_id, outcome)
    VALUES (?, 'later', 'someone-else@example.test', 'refunds', 'x', 'refund', 'r-replace', 'denied')
    ON CONFLICT (id) DO UPDATE SET actor_email = excluded.actor_email, outcome = excluded.outcome`,
  "an upsert with ON CONFLICT DO NOTHING": `INSERT INTO audit_events
    (id, at, actor_email, app, action, resource_type, resource_id, outcome)
    VALUES (?, 'later', 'someone-else@example.test', 'refunds', 'x', 'refund', 'r-replace', 'denied')
    ON CONFLICT (id) DO NOTHING`,
  "INSERT OR IGNORE": `INSERT OR IGNORE INTO audit_events
    (id, at, actor_email, app, action, resource_type, resource_id, outcome)
    VALUES (?, 'later', 'someone-else@example.test', 'refunds', 'x', 'refund', 'r-replace', 'denied')`,
  "a plain INSERT": `INSERT INTO audit_events
    (id, at, actor_email, app, action, resource_type, resource_id, outcome)
    VALUES (?, 'later', 'someone-else@example.test', 'refunds', 'x', 'refund', 'r-replace', 'denied')`,
};

test.each(Object.entries(REPLACING_STATEMENTS))(
  "%s on an existing row fails at the database level",
  async (label, sql) => {
    const resourceId = `r-${label}`;
    const saved = await recordAudit({ ...base, resourceId });
    const { sqlite } = getAuditDb();
    const count = () =>
      (sqlite.prepare("SELECT count(*) AS n FROM audit_events").get() as { n: number }).n;
    const rowsBefore = count();

    expect(() => sqlite.prepare(sql).run(saved.id)).toThrow(/append-only/);

    expect(count()).toBe(rowsBefore);
    expect(await listAudit({ resourceId })).toEqual([saved]);
    expect(await listAudit({ resourceId: "r-replace" })).toEqual([]);
  },
);

test("a new row can still be added after a refused statement", async () => {
  const first = await recordAudit({ ...base, resourceId: "r-append" });
  const second = await recordAudit({ ...base, resourceId: "r-append" });
  expect(second.id).toBeGreaterThan(first.id);
  expect(await listAudit({ resourceId: "r-append" })).toHaveLength(2);
});
