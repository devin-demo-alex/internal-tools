import { refresh } from "next/cache";
import Link from "next/link";
import { forbidden, notFound } from "next/navigation";

import {
  forbiddenPageOnDenied,
  requireAppAccess,
} from "@/platform/actions";
import { requireUser } from "@/platform/auth";
import { can } from "@/platform/policy";
import {
  getPayment,
  getRefund,
  ServiceError,
} from "@/platform/services/payments";
import { ActionButton, DetailLayout, type ActionInput } from "@/platform/ui";

import { approveRefundRequest, rejectRefundRequest } from "../actions";
import { formatDate, formatMoney } from "../components/format";
import { RefundStatusBadge } from "../components/refund-status";
import { permissions, type RefundResource } from "../permissions";

// Who may see this page is decided per request, so navigation waits for the server.
export const instant = false;

async function loadRefund(id: string) {
  try {
    return await getRefund(id);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }
}

export default async function RefundPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAppAccess("refunds");
  if (!can(user, permissions, "refunds.view")) forbidden();

  const { id } = await params;
  const refund = await loadRefund(id);
  const payment = await getPayment(refund.paymentId);

  async function approveAction() {
    "use server";
    const user = await requireUser();
    const outcome = await forbiddenPageOnDenied(() =>
      approveRefundRequest(user, id),
    );
    if (!outcome.error) refresh();
    return outcome;
  }

  async function rejectAction({ note }: ActionInput) {
    "use server";
    const user = await requireUser();
    const outcome = await forbiddenPageOnDenied(() =>
      rejectRefundRequest(user, id, note ?? ""),
    );
    if (!outcome.error) refresh();
    return outcome;
  }

  // The same fields runAction gets, so the buttons match the server check.
  const resource: RefundResource = {
    id: refund.id,
    requestedBy: refund.requestedBy,
  };
  const undecided = refund.status === "requested";
  const amount = formatMoney(refund.amountCents, payment.currency);

  return (
    <DetailLayout
      title={`Refund ${refund.id}`}
      fields={[
        { label: "Status", value: <RefundStatusBadge status={refund.status} /> },
        { label: "Refund amount", value: amount },
        { label: "Reason", value: refund.reason },
        { label: "Requested by", value: refund.requestedBy },
        { label: "Requested at", value: formatDate(refund.requestedAt) },
        { label: "Decided by", value: refund.decidedBy ?? "Not decided yet" },
        {
          label: "Decided at",
          value: refund.decidedAt ? formatDate(refund.decidedAt) : "Not decided yet",
        },
        { label: "Decision note", value: refund.decisionNote ?? "None" },
        { label: "Original payment", value: payment.id },
        { label: "Customer", value: payment.customerName },
        {
          label: "Payment amount",
          value: formatMoney(payment.amountCents, payment.currency),
        },
        { label: "Paid at", value: formatDate(payment.createdAt) },
      ]}
      actions={
        <>
          {undecided && can(user, permissions, "refunds.approve", resource) ? (
            <ActionButton
              label="Approve"
              confirmTitle="Approve refund"
              confirmDescription={`This approves the refund of ${amount} to ${payment.customerName}.`}
              action={approveAction}
            />
          ) : null}
          {undecided && can(user, permissions, "refunds.reject", resource) ? (
            <ActionButton
              label="Reject"
              variant="destructive"
              confirmTitle="Reject refund"
              confirmDescription={`This rejects the refund of ${amount} to ${payment.customerName}.`}
              requireNote
              action={rejectAction}
            />
          ) : null}
        </>
      }
    >
      <Link href="/refunds" className="text-sm underline">
        Back to refunds
      </Link>
    </DetailLayout>
  );
}
