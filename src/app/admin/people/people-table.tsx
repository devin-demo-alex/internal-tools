"use client";

import type { User } from "@/platform/contracts";
import { DataTable, type DataTableColumn } from "@/platform/ui";
import { GroupList } from "../group-list";

const columns: DataTableColumn<User>[] = [
  { id: "name", header: "Name" },
  { id: "email", header: "Email" },
  {
    id: "groups",
    header: "Groups",
    value: (person) => person.groups.join(", "),
    cell: (person) => <GroupList groups={person.groups} />,
  },
];

export function PeopleTable({ people }: { people: User[] }) {
  return (
    <DataTable
      columns={columns}
      rows={people}
      getRowId={(person) => person.email}
      emptyMessage="No people."
    />
  );
}
