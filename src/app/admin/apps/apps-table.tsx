"use client";

import type { AppEntry } from "@/platform/contracts";
import { DataTable, type DataTableColumn } from "@/platform/ui";
import { GroupList } from "../group-list";

const columns: DataTableColumn<AppEntry>[] = [
  { id: "name", header: "Name" },
  { id: "description", header: "Description" },
  {
    id: "path",
    header: "Path",
    cell: (app) => <code className="text-xs">{app.path}</code>,
  },
  {
    id: "openGroups",
    header: "Groups allowed to open it",
    value: (app) => app.openGroups.join(", "),
    cell: (app) => <GroupList groups={app.openGroups} />,
  },
];

export function AppsTable({ apps }: { apps: AppEntry[] }) {
  return (
    <DataTable
      columns={columns}
      rows={apps}
      getRowId={(app) => app.id}
      emptyMessage="No apps are registered."
    />
  );
}
