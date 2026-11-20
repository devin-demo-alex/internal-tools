import { listAudit, type AuditEvent, type AuditOutcome } from "@/platform/audit";

// Keyed by outcome so a new outcome in the audit schema fails the typecheck here.
const OUTCOME_SET: Record<AuditOutcome, true> = {
  allowed: true,
  denied: true,
  completed: true,
  failed: true,
};

export const AUDIT_OUTCOMES = Object.keys(OUTCOME_SET) as AuditOutcome[];

/** The value a filter has when it is not narrowing anything. */
export const ANY = "all";

/** The most entries read from the log for one page view. */
export const MAX_ENTRIES = 5000;

export type AuditPageFilters = {
  person?: string;
  app?: string;
  outcome?: AuditOutcome;
  /** First day to include, as YYYY-MM-DD in UTC. */
  from?: string;
  /** Last day to include, as YYYY-MM-DD in UTC. */
  to?: string;
};

export type AuditFilterErrors = { from?: string; to?: string };

type RawParams = Record<string, string | string[] | undefined>;

function text(params: RawParams, key: string): string | undefined {
  const raw = params[key];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  return value && value !== ANY ? value : undefined;
}

function isDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

/** The from and to days exactly as typed, so a bad one can be shown back for correction. */
export function enteredDays(params: RawParams): { from: string; to: string } {
  return { from: text(params, "from") ?? "", to: text(params, "to") ?? "" };
}

/** Reads the filters from the page's query string. A bad date is reported, not applied. */
export function parseAuditFilters(params: RawParams): {
  filters: AuditPageFilters;
  errors: AuditFilterErrors;
} {
  const filters: AuditPageFilters = {};
  const errors: AuditFilterErrors = {};

  const person = text(params, "person");
  if (person) filters.person = person;
  const app = text(params, "app");
  if (app) filters.app = app;
  const outcome = text(params, "outcome");
  if (outcome && Object.hasOwn(OUTCOME_SET, outcome)) {
    filters.outcome = outcome as AuditOutcome;
  }

  for (const key of ["from", "to"] as const) {
    const day = text(params, key);
    if (!day) continue;
    if (isDay(day)) filters[key] = day;
    else errors[key] = "Use a date like 2026-01-31.";
  }
  if (filters.from && filters.to && filters.from > filters.to) {
    errors.to = "The last day is before the first day.";
    delete filters.to;
  }
  return { filters, errors };
}

/** Audit entries matching every filter, newest first. Days are whole UTC days, inclusive. */
export async function findAuditEntries(
  filters: AuditPageFilters = {},
): Promise<AuditEvent[]> {
  const entries = await listAudit({
    actorEmail: filters.person,
    app: filters.app,
    outcome: filters.outcome,
    limit: MAX_ENTRIES,
  });
  return entries.filter((entry) => {
    const day = entry.at.slice(0, 10);
    if (filters.from && day < filters.from) return false;
    if (filters.to && day > filters.to) return false;
    return true;
  });
}
