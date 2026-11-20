import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * `denied`: permission was refused and the action did not run.
 * `allowed`: permission was given; written before the action runs.
 * `completed` / `failed`: how an allowed action ended; written after it.
 */
export const AUDIT_OUTCOMES = ["allowed", "denied", "completed", "failed"] as const;

export const auditEvents = sqliteTable("audit_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  at: text("at").notNull(),
  actorEmail: text("actor_email").notNull(),
  app: text("app").notNull(),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  outcome: text("outcome", { enum: AUDIT_OUTCOMES }).notNull(),
  before: text("before", { mode: "json" }).$type<unknown>(),
  after: text("after", { mode: "json" }).$type<unknown>(),
});

export type AuditEvent = typeof auditEvents.$inferSelect;
export type AuditOutcome = AuditEvent["outcome"];
