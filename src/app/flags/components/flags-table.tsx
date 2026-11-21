"use client";

import type { FlagEnvironment } from "@/platform/services/flags";
import { ActionButton, DataTable, type DataTableColumn } from "@/platform/ui";

import { FlagStateBadge } from "./flag-state";
import { formatDate } from "./format";

export type FlagRow = {
  key: string;
  description: string;
  environment: FlagEnvironment;
  enabled: boolean;
  updatedBy: string;
  updatedAt: string;
  /** Decided on the server with can(...). The server check in runAction is the enforcement. */
  canToggle: boolean;
};

export type ToggleInput = {
  key: string;
  environment: FlagEnvironment;
  enabled: boolean;
};

type FlagsTableProps = {
  rows: FlagRow[];
  toggle: (input: ToggleInput) => Promise<{ error?: string }>;
};

export function FlagsTable({ rows, toggle }: FlagsTableProps) {
  const columns: DataTableColumn<FlagRow>[] = [
    { id: "key", header: "Key", cell: (row) => <span className="font-medium">{row.key}</span> },
    { id: "description", header: "Description" },
    { id: "environment", header: "Environment" },
    {
      id: "enabled",
      header: "On or off",
      value: (row) => (row.enabled ? "on" : "off"),
      cell: (row) => <FlagStateBadge enabled={row.enabled} />,
    },
    { id: "updatedBy", header: "Last changed by" },
    {
      id: "updatedAt",
      header: "Last changed at",
      cell: (row) => formatDate(row.updatedAt),
    },
    {
      id: "toggle",
      header: "Action",
      sortable: false,
      value: () => "",
      cell: (row) =>
        row.canToggle ? (
          <ActionButton
            label={row.enabled ? "Turn off" : "Turn on"}
            variant={row.enabled ? "destructive" : "default"}
            confirmTitle={row.enabled ? "Turn flag off" : "Turn flag on"}
            confirmDescription={`This turns ${row.key} ${row.enabled ? "off" : "on"} in ${row.environment}.`}
            action={() =>
              toggle({ key: row.key, environment: row.environment, enabled: !row.enabled })
            }
          />
        ) : null,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(row) => `${row.key}:${row.environment}`}
      emptyMessage="No flags match."
    />
  );
}
