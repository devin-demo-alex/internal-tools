"use client";

import Link from "next/link";
import { useState, type MouseEvent } from "react";

import { Button } from "@/components/ui/button";
import type { AuditEvent, AuditOutcome } from "@/platform/audit";
import {
  DataTable,
  DetailLayout,
  SelectField,
  StatusBadge,
  TextField,
  type DataTableColumn,
  type SelectOption,
  type StatusTone,
} from "@/platform/ui";
import type { AuditFilterErrors, AuditPageFilters } from "./query";

// Same value as ANY in ./query, which is server-only code.
const ANY = "all";

const outcomeTones: Record<AuditOutcome, StatusTone> = {
  allowed: "info",
  denied: "danger",
  completed: "success",
  failed: "warning",
};

function formatTime(at: string): string {
  return `${at.slice(0, 10)} ${at.slice(11, 19)} UTC`;
}

function AuditValue({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <h3 className="text-sm font-medium">{label}</h3>
      {value === null || value === undefined ? (
        <p className="text-sm text-muted-foreground">No value recorded</p>
      ) : (
        <pre
          aria-label={`${label} value`}
          className="overflow-x-auto rounded-md border bg-muted p-3 text-xs"
        >
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}

export type AuditLogProps = {
  entries: AuditEvent[];
  filters: AuditPageFilters;
  errors: AuditFilterErrors;
  people: SelectOption[];
  apps: SelectOption[];
  outcomes: SelectOption[];
};

export function AuditLog({
  entries,
  filters,
  errors,
  people,
  apps,
  outcomes,
}: AuditLogProps) {
  const [selectedId, setSelectedId] = useState<number>();
  const selected = entries.find((entry) => entry.id === selectedId);

  const columns: DataTableColumn<AuditEvent>[] = [
    {
      id: "at",
      header: "When",
      sortable: false,
      cell: (entry) => (
        <button
          type="button"
          data-audit-id={entry.id}
          aria-expanded={entry.id === selectedId}
          className="rounded-sm text-left underline-offset-4 outline-none hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {formatTime(entry.at)}
        </button>
      ),
    },
    { id: "actorEmail", header: "Person", sortable: false },
    { id: "app", header: "App", sortable: false },
    { id: "action", header: "Action", sortable: false },
    {
      id: "resource",
      header: "Resource",
      sortable: false,
      value: (entry) => `${entry.resourceType} ${entry.resourceId}`,
    },
    {
      id: "outcome",
      header: "Outcome",
      sortable: false,
      cell: (entry) => (
        <StatusBadge label={entry.outcome} tone={outcomeTones[entry.outcome]} />
      ),
    },
  ];

  // The shared table has no row-click hook, so a click anywhere in a row is
  // matched to the button in its first cell.
  function selectClickedRow(event: MouseEvent<HTMLDivElement>) {
    const row = (event.target as HTMLElement).closest("tbody tr");
    const id = row?.querySelector<HTMLElement>("[data-audit-id]")?.dataset.auditId;
    if (id) setSelectedId(Number(id));
  }

  const withAny = (options: SelectOption[], label: string) => [
    { value: ANY, label },
    ...options,
  ];

  return (
    <div className="flex flex-col gap-6">
      <form
        method="get"
        action="/admin/audit"
        aria-label="Filters"
        className="grid grid-cols-1 items-start gap-4 rounded-lg border p-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <SelectField
          label="Person"
          name="person"
          defaultValue={filters.person ?? ANY}
          options={withAny(people, "Everyone")}
        />
        <SelectField
          label="App"
          name="app"
          defaultValue={filters.app ?? ANY}
          options={withAny(apps, "All apps")}
        />
        <SelectField
          label="Outcome"
          name="outcome"
          defaultValue={filters.outcome ?? ANY}
          options={withAny(outcomes, "All outcomes")}
        />
        <TextField
          label="From day"
          name="from"
          defaultValue={filters.from ?? ""}
          placeholder="YYYY-MM-DD"
          error={errors.from}
        />
        <TextField
          label="To day"
          name="to"
          defaultValue={filters.to ?? ""}
          placeholder="YYYY-MM-DD"
          error={errors.to}
        />
        <div className="flex items-center gap-3 sm:col-span-2 lg:col-span-5">
          <Button type="submit">Apply filters</Button>
          <Link href="/admin/audit" className="text-sm underline underline-offset-4">
            Clear filters
          </Link>
        </div>
      </form>

      <p className="text-sm text-muted-foreground" aria-live="polite">
        {entries.length === 1 ? "1 entry" : `${entries.length} entries`}. Click a
        row to see the before and after values.
      </p>

      {selected ? (
        <div className="rounded-lg border p-4" data-testid="audit-detail">
          <DetailLayout
            title={`Entry ${selected.id}`}
            actions={
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedId(undefined)}
              >
                Close
              </Button>
            }
            fields={[
              { label: "When", value: formatTime(selected.at) },
              { label: "Person", value: selected.actorEmail },
              { label: "App", value: selected.app },
              { label: "Action", value: selected.action },
              {
                label: "Resource",
                value: `${selected.resourceType} ${selected.resourceId}`,
              },
              {
                label: "Outcome",
                value: (
                  <StatusBadge
                    label={selected.outcome}
                    tone={outcomeTones[selected.outcome]}
                  />
                ),
              },
            ]}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <AuditValue label="Before" value={selected.before} />
              <AuditValue label="After" value={selected.after} />
            </div>
          </DetailLayout>
        </div>
      ) : null}

      <div onClick={selectClickedRow} className="[&_tbody_tr]:cursor-pointer">
        <DataTable
          columns={columns}
          rows={entries}
          getRowId={(entry) => String(entry.id)}
          emptyMessage="No audit entries match these filters."
        />
      </div>
    </div>
  );
}
