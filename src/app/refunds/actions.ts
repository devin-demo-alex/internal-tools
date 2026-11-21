import { runAction } from "@/platform/actions";
import type { User } from "@/platform/contracts";
import {
  approveRefund,
  createRefund,
  getRefund,
  rejectRefund,
  ServiceError,
  type Refund,
} from "@/platform/services/payments";
import type { RefundResource } from "./permissions";

// Each action takes the signed-in user from the page, never from the browser.
// A refusal by the permission check is thrown as ForbiddenError.
// A refusal by the payments service is returned as { error } for the page to show.

export type ActionResult = { error?: string };

const APP = "refunds";

/**
 * The one place a refund is turned into what the permission check reads.
 * The actions pass it to runAction and the detail page passes it to can().
 * Only the fields the check needs: runAction stores them in the audit log.
 */
export function toResource(refund: Refund): { type: "refund" } & RefundResource {
  return {
    type: "refund",
    id: refund.id,
    status: refund.status,
    requestedBy: refund.requestedBy,
  };
}

function serviceRefusal(error: unknown): ActionResult {
  if (error instanceof ServiceError) return { error: error.message };
  throw error;
}

export async function requestRefund(
  user: User,
  input: { paymentId: string; amountCents: number; reason: string },
): Promise<ActionResult & { id?: string }> {
  try {
    const id = await runAction(
      user,
      APP,
      "refunds.request",
      { type: "refund", id: "new" },
      async () => {
        const refund = await createRefund({ ...input, requestedBy: user.email });
        return {
          // The refund has an id only now, so the completed row is filed under it.
          resourceId: refund.id,
          after: {
            id: refund.id,
            paymentId: refund.paymentId,
            amount: refund.amountCents,
            status: refund.status,
          },
          result: refund.id,
        };
      },
    );
    return { id };
  } catch (error) {
    return serviceRefusal(error);
  }
}

export async function approveRefundRequest(
  user: User,
  refundId: string,
): Promise<ActionResult> {
  try {
    const refund = await getRefund(refundId);
    await runAction(user, APP, "refunds.approve", toResource(refund), async () => {
      const approved = await approveRefund(refund.id, { approvedBy: user.email });
      return {
        before: { status: refund.status },
        after: { status: approved.status },
      };
    });
    return {};
  } catch (error) {
    return serviceRefusal(error);
  }
}

export async function rejectRefundRequest(
  user: User,
  refundId: string,
  note: string,
): Promise<ActionResult> {
  try {
    const refund = await getRefund(refundId);
    await runAction(user, APP, "refunds.reject", toResource(refund), async () => {
      const rejected = await rejectRefund(refund.id, { rejectedBy: user.email, note });
      return {
        before: { status: refund.status },
        after: { status: rejected.status },
      };
    });
    return {};
  } catch (error) {
    return serviceRefusal(error);
  }
}
