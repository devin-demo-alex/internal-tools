import type { User } from "@/platform/contracts";
import type { Permissions } from "@/platform/policy";

/** The case fields the permission check reads. Pass exactly these to runAction and can(). */
export type CaseResource = {
  id: string;
  status: string;
  assignedTo: string | null;
  riskScore: number;
};

const ANALYSTS = "kyc-analysts";
const LEADS = "kyc-leads";

/** Analysts may approve only below this risk score. */
const ANALYST_APPROVE_BELOW = 80;

function isAnalystAssigned(user: User, kycCase: CaseResource): boolean {
  return (
    user.groups.includes(ANALYSTS) &&
    typeof kycCase?.assignedTo === "string" &&
    kycCase.assignedTo.toLowerCase() === user.email.toLowerCase()
  );
}

function isLeadOnOpenCase(user: User, kycCase: CaseResource): boolean {
  return user.groups.includes(LEADS) && kycCase?.status === "open";
}

function isUnassigned(_user: User, kycCase: CaseResource): boolean {
  return kycCase?.assignedTo === null;
}

function mayApprove(user: User, kycCase: CaseResource): boolean {
  return (
    isLeadOnOpenCase(user, kycCase) ||
    (isAnalystAssigned(user, kycCase) &&
      typeof kycCase.riskScore === "number" &&
      kycCase.riskScore < ANALYST_APPROVE_BELOW)
  );
}

function mayReject(user: User, kycCase: CaseResource): boolean {
  return isLeadOnOpenCase(user, kycCase) || isAnalystAssigned(user, kycCase);
}

/** The full ID number is for the analyst the case is assigned to and for leads. */
function mayViewFullId(user: User, kycCase: CaseResource): boolean {
  return user.groups.includes(LEADS) || isAnalystAssigned(user, kycCase);
}

export const permissions: Permissions = {
  "kyc.view": { groups: [ANALYSTS, LEADS] },
  "kyc.claim": { groups: [ANALYSTS, LEADS], when: isUnassigned },
  "kyc.approve": { groups: [ANALYSTS, LEADS], when: mayApprove },
  "kyc.reject": { groups: [ANALYSTS, LEADS], when: mayReject },
  "kyc.escalate": { groups: [ANALYSTS], when: isAnalystAssigned },
  // Decides masking. A view that reveals the full ID number is audited.
  "kyc.viewFullId": { groups: [ANALYSTS, LEADS], when: mayViewFullId },
};
