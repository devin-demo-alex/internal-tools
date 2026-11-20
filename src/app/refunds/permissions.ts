import type { User } from "@/platform/contracts";
import type { Permissions } from "@/platform/policy";

/** The refund fields the permission check reads. Pass exactly these to runAction and can(). */
export type RefundResource = {
  id: string;
  requestedBy: string;
};

/** Nobody decides on a refund they requested themselves. */
function isNotRequester(user: User, refund: RefundResource): boolean {
  return (
    typeof refund?.requestedBy === "string" &&
    refund.requestedBy.toLowerCase() !== user.email.toLowerCase()
  );
}

export const permissions: Permissions = {
  "refunds.view": { groups: ["support-agents", "refund-approvers"] },
  "refunds.request": { groups: ["support-agents"] },
  "refunds.approve": { groups: ["refund-approvers"], when: isNotRequester },
  "refunds.reject": { groups: ["refund-approvers"], when: isNotRequester },
};
