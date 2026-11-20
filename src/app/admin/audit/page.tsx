import { requireAppAccess } from "@/platform/actions";
import { requireUser } from "@/platform/auth";
import { listPeople } from "@/platform/directory";
import { apps } from "@/platform/registry";
import { PageHeading } from "../page-heading";
import { AuditLog } from "./audit-log";
import {
  AUDIT_OUTCOMES,
  enteredDays,
  findAuditEntries,
  MAX_ENTRIES,
  parseAuditFilters,
} from "./query";

// Who may see this page is decided per request, so navigation waits for the server.
export const instant = false;

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireUser();
  await requireAppAccess("admin");
  const params = await searchParams;
  const { filters, errors } = parseAuditFilters(params);
  // A bad date shows its message instead of results that ignore the date.
  const hasErrors = Object.keys(errors).length > 0;
  const entries = hasErrors ? [] : await findAuditEntries(filters);
  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Audit log"
        summary={`Every action attempted on the platform, newest first. Read-only. Dates are in UTC. At most ${MAX_ENTRIES} entries are read at a time.`}
      />
      <AuditLog
        entries={entries}
        filters={filters}
        errors={errors}
        days={enteredDays(params)}
        people={[
          ...listPeople().map((person) => ({
            value: person.email,
            label: `${person.name} (${person.email})`,
          })),
          { value: "anonymous", label: "Not signed in (anonymous)" },
        ]}
        apps={apps.map((app) => ({ value: app.id, label: app.name }))}
        outcomes={AUDIT_OUTCOMES.map((outcome) => ({ value: outcome, label: outcome }))}
      />
    </div>
  );
}
