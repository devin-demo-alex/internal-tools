"use client";

import { DataTable, StatusBadge, type DataTableColumn } from "@/platform/ui";
import type { RolesGrid, RolesGridRow } from "./grid";

export const NO_ACTIONS = "No actions yet";
export const CONDITION_NOTE =
  "Conditional: a condition applies. Being in the group is not enough; the action is refused unless the condition in permissions.ts is also met.";

export function RolesGridTable({ grid }: { grid: RolesGrid }) {
  if (grid.rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{NO_ACTIONS}</p>;
  }
  const columns: DataTableColumn<RolesGridRow>[] = [
    {
      id: "action",
      header: "Action",
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-2">
          <code className="text-xs">{row.action}</code>
          {row.hasCondition ? (
            <StatusBadge label="Conditional" tone="warning" />
          ) : null}
        </span>
      ),
    },
    ...grid.groups.map(
      (group): DataTableColumn<RolesGridRow> => ({
        id: group,
        header: group,
        sortable: false,
        value: (row) => (row.allowed[group] ? "Allowed" : "No"),
        cell: (row) =>
          row.allowed[group] ? (
            <StatusBadge label="Allowed" tone="success" />
          ) : (
            <span className="text-muted-foreground">No</span>
          ),
      }),
    ),
  ];
  return (
    <div className="flex flex-col gap-2">
      <DataTable columns={columns} rows={grid.rows} getRowId={(row) => row.action} />
      {grid.rows.some((row) => row.hasCondition) ? (
        <p className="text-sm text-muted-foreground">{CONDITION_NOTE}</p>
      ) : null}
    </div>
  );
}
