"use client";

import Link from "next/link";

import type { RefundStatus } from "@/platform/services/payments";
import { DataTable, type DataTableColumn } from "@/platform/ui";

import { formatDate, formatMoney } from "./format";
import { RefundStatusBadge } from "./refund-status";

export type RefundRow = {
  id: string;
  customer: string;
  currency: string;
  paymentAmountCents: number;
  refundAmountCents: number;
  reason: string;
  status: RefundStatus;
  requestedBy: string;
  requestedAt: string;
};

const columns: DataTableColumn<RefundRow>[] = [
  {
    id: "id",
    header: "Refund",
    cell: (row) => (
      <Link href={`/refunds/${row.id}`} className="font-medium underline">
        {row.id}
      </Link>
    ),
  },
  { id: "customer", header: "Customer" },
  {
    id: "paymentAmountCents",
    header: "Payment amount",
    cell: (row) => formatMoney(row.paymentAmountCents, row.currency),
  },
  {
    id: "refundAmountCents",
    header: "Refund amount",
    cell: (row) => formatMoney(row.refundAmountCents, row.currency),
  },
  { id: "reason", header: "Reason" },
  {
    id: "status",
    header: "Status",
    cell: (row) => <RefundStatusBadge status={row.status} />,
  },
  { id: "requestedBy", header: "Requested by" },
  {
    id: "requestedAt",
    header: "Requested at",
    cell: (row) => formatDate(row.requestedAt),
  },
];

export function RefundsTable({ rows }: { rows: RefundRow[] }) {
  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      emptyMessage="No refund requests match."
    />
  );
}
