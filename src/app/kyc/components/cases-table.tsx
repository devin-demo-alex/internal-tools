"use client";

import Link from "next/link";

import type { CaseStatus } from "@/platform/services/identity";
import { DataTable, type DataTableColumn } from "@/platform/ui";

import { CaseStatusBadge } from "./case-status";
import { formatDocumentType } from "./format";

export type CaseRow = {
  id: string;
  customerName: string;
  documentType: string;
  riskScore: number;
  status: CaseStatus;
  assignedTo: string | null;
};

const columns: DataTableColumn<CaseRow>[] = [
  {
    id: "id",
    header: "Case",
    cell: (row) => (
      <Link href={`/kyc/${row.id}`} className="font-medium underline">
        {row.id}
      </Link>
    ),
  },
  { id: "customerName", header: "Customer" },
  {
    id: "documentType",
    header: "Document type",
    cell: (row) => formatDocumentType(row.documentType),
  },
  { id: "riskScore", header: "Risk score" },
  {
    id: "status",
    header: "Status",
    cell: (row) => <CaseStatusBadge status={row.status} />,
  },
  {
    id: "assignedTo",
    header: "Assigned to",
    cell: (row) => row.assignedTo ?? "Unassigned",
  },
];

export function CasesTable({ rows }: { rows: CaseRow[] }) {
  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      emptyMessage="No cases match."
    />
  );
}
