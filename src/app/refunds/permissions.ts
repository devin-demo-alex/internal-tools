import type { User } from "@/platform/contracts";
import type { Permissions } from "@/platform/policy";

/** The refund fields the permission check reads. toResource in actions.ts builds it. */
export type RefundResource = {
  id: string;
  status: string;
  requestedBy: string;
};

/** Nobody decides on a refund they requested themselves. */
function isNotRequester(user: User, refund: RefundResource): boolean {
  return (
    typeof refund?.requestedBy === "string" &&
    refund.requestedBy.toLowerCase() !== user.email.toLowerCase()
  );
}

/** A refund is decided once: only while its status is still "requested". */
function isUndecided(refund: RefundResource): boolean {
  return refund?.status === "requested";
}

/** Both conditions for approving or rejecting a refund. */
function mayDecide(user: User, refund: RefundResource): boolean {
  return isUndecided(refund) && isNotRequester(user, refund);
}

export const permissions: Permissions = {
  "refunds.view": { groups: ["support-agents", "refund-approvers"] },
  "refunds.request": { groups: ["support-agents"] },
  "refunds.approve": { groups: ["refund-approvers"], when: mayDecide },
  "refunds.reject": { groups: ["refund-approvers"], when: mayDecide },
};
