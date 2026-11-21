import type { User } from "@/platform/contracts";
import type { Permissions } from "@/platform/policy";

/** The case fields the permission check reads. toResource in actions.ts builds it. */
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

/** A case is claimed and decided only while its status is still "open". */
function isOpen(kycCase: CaseResource): boolean {
  return kycCase?.status === "open";
}

function mayClaim(_user: User, kycCase: CaseResource): boolean {
  return isOpen(kycCase) && kycCase.assignedTo === null;
}

function mayApprove(user: User, kycCase: CaseResource): boolean {
  if (!isOpen(kycCase)) return false;
  return (
    user.groups.includes(LEADS) ||
    (isAnalystAssigned(user, kycCase) &&
      typeof kycCase.riskScore === "number" &&
      kycCase.riskScore < ANALYST_APPROVE_BELOW)
  );
}

function mayReject(user: User, kycCase: CaseResource): boolean {
  if (!isOpen(kycCase)) return false;
  return user.groups.includes(LEADS) || isAnalystAssigned(user, kycCase);
}

function mayEscalate(user: User, kycCase: CaseResource): boolean {
  return isOpen(kycCase) && isAnalystAssigned(user, kycCase);
}

/** The full ID number is for the analyst the case is assigned to and for leads. */
function mayViewFullId(user: User, kycCase: CaseResource): boolean {
  return user.groups.includes(LEADS) || isAnalystAssigned(user, kycCase);
}

export const permissions: Permissions = {
  "kyc.view": { groups: [ANALYSTS, LEADS] },
  "kyc.claim": { groups: [ANALYSTS, LEADS], when: mayClaim },
  "kyc.approve": { groups: [ANALYSTS, LEADS], when: mayApprove },
  "kyc.reject": { groups: [ANALYSTS, LEADS], when: mayReject },
  "kyc.escalate": { groups: [ANALYSTS], when: mayEscalate },
  // Decides masking. A view that reveals the full ID number is audited.
  "kyc.viewFullId": { groups: [ANALYSTS, LEADS], when: mayViewFullId },
};
