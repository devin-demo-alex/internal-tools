import { refresh } from "next/cache";
import { forbidden } from "next/navigation";

import {
  forbiddenPageOnDenied,
  requireAppAccess,
} from "@/platform/actions";
import { requireUser } from "@/platform/auth";
import { can } from "@/platform/policy";
import {
  listPayments,
  listRefunds,
  type RefundStatus,
} from "@/platform/services/payments";

import { requestRefund } from "./actions";
import { formatMoney } from "./components/format";
import { NewRefundForm, type NewRefundInput } from "./components/new-refund-form";
import { RefundsTable, type RefundRow } from "./components/refunds-table";
import { StatusFilter } from "./components/status-filter";
import { permissions } from "./permissions";

// Who may see this page is decided per request, so navigation waits for the server.
export const instant = false;

const STATUSES: RefundStatus[] = ["requested", "approved", "rejected"];

async function requestAction(input: NewRefundInput) {
  "use server";
  const user = await requireUser();
  const outcome = await forbiddenPageOnDenied(() => requestRefund(user, input));
  if (!outcome.error) refresh();
  return outcome;
}

export default async function RefundsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const user = await requireAppAccess("refunds");
  if (!can(user, permissions, "refunds.view")) forbidden();

  const { status: wanted } = await searchParams;
  const status = STATUSES.find((candidate) => candidate === wanted);
  const [refunds, payments] = await Promise.all([
    listRefunds({ status }),
    listPayments(),
  ]);
  const paymentsById = new Map(payments.map((payment) => [payment.id, payment]));

  const rows: RefundRow[] = refunds.map((refund) => {
    const payment = paymentsById.get(refund.paymentId);
    return {
      id: refund.id,
      customer: payment?.customerName ?? "Unknown",
      currency: payment?.currency ?? "USD",
      paymentAmountCents: payment?.amountCents ?? 0,
      refundAmountCents: refund.amountCents,
      reason: refund.reason,
      status: refund.status,
      requestedBy: refund.requestedBy,
      requestedAt: refund.requestedAt,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Refunds</h1>
      {can(user, permissions, "refunds.request") ? (
        <div>
          <NewRefundForm
            action={requestAction}
            payments={payments.map((payment) => ({
              value: payment.id,
              label: `${payment.id} · ${payment.customerName} · ${formatMoney(payment.amountCents, payment.currency)}`,
            }))}
          />
        </div>
      ) : null}
      <StatusFilter status={status} />
      <RefundsTable rows={rows} />
    </div>
  );
}
