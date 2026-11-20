import { and, desc, eq, type SQL } from "drizzle-orm";
import { getAuditDb } from "./db";
import { auditEvents, type AuditEvent, type AuditOutcome } from "./schema";

export type { AuditEvent, AuditOutcome };

export type AuditInput = {
  actorEmail: string;
  app: string;
  action: string;
  resourceType: string;
  resourceId: string;
  outcome: AuditOutcome;
  before?: unknown;
  after?: unknown;
};

export type AuditFilters = {
  actorEmail?: string;
  app?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  outcome?: AuditOutcome;
  limit?: number;
};

/** Appends one entry. There is deliberately no way to change or remove one. */
export async function recordAudit(event: AuditInput): Promise<AuditEvent> {
  return getAuditDb()
    .orm.insert(auditEvents)
    .values({
      at: new Date().toISOString(),
      actorEmail: event.actorEmail,
      app: event.app,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      outcome: event.outcome,
      before: event.before ?? null,
      after: event.after ?? null,
    })
    .returning()
    .get();
}

/** Entries matching every given filter, newest first. */
export async function listAudit(
  filters: AuditFilters = {},
): Promise<AuditEvent[]> {
  const conditions: SQL[] = [];
  if (filters.actorEmail !== undefined) {
    conditions.push(eq(auditEvents.actorEmail, filters.actorEmail));
  }
  if (filters.app !== undefined) {
    conditions.push(eq(auditEvents.app, filters.app));
  }
  if (filters.action !== undefined) {
    conditions.push(eq(auditEvents.action, filters.action));
  }
  if (filters.resourceType !== undefined) {
    conditions.push(eq(auditEvents.resourceType, filters.resourceType));
  }
  if (filters.resourceId !== undefined) {
    conditions.push(eq(auditEvents.resourceId, filters.resourceId));
  }
  if (filters.outcome !== undefined) {
    conditions.push(eq(auditEvents.outcome, filters.outcome));
  }
  return getAuditDb()
    .orm.select()
    .from(auditEvents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditEvents.id))
    .limit(filters.limit ?? 200)
    .all();
}
