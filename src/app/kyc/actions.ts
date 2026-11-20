import { ForbiddenError, runAction } from "@/platform/actions";
import type { User } from "@/platform/contracts";
import { authorize } from "@/platform/policy";
import {
  claimCase,
  decideCase,
  getCase,
  listCases,
  ServiceError,
  type CaseDecision,
  type CaseStatus,
  type IdentityCase,
} from "@/platform/services/identity";
import {
  maySeeFullIdNumber,
  permissions,
  type CaseResource,
} from "./permissions";

// Each action takes the signed-in user from the page, never from the browser.
// A refusal by the permission check is thrown as ForbiddenError.
// A refusal by the identity service is returned as { error } for the page to show.

export type ActionResult = { error?: string };

const APP = "kyc";

/** A row of the list page. It has no ID number and no date of birth. */
export type CaseSummary = {
  id: string;
  customerName: string;
  documentType: string;
  riskScore: number;
  status: CaseStatus;
  assignedTo: string | null;
};

/** What the detail page gets. `idNumber` is already masked when `idNumberMasked` is true. */
export type CaseDetail = CaseSummary & {
  dateOfBirth: string;
  idNumber: string;
  idNumberMasked: boolean;
  notes: string[];
  decidedBy: string | null;
  decidedAt: string | null;
};

/**
 * Only the fields the permission check needs: this is stored in the audit log.
 * The ID number and the date of birth must never be added here.
 */
function toResource(kycCase: IdentityCase): { type: "kyc-case" } & CaseResource {
  return {
    type: "kyc-case",
    id: kycCase.id,
    status: kycCase.status,
    assignedTo: kycCase.assignedTo,
    riskScore: kycCase.riskScore,
  };
}

function serviceRefusal(error: unknown): ActionResult {
  if (error instanceof ServiceError) return { error: error.message };
  throw error;
}

function requireView(user: User): void {
  const decision = authorize(user, permissions, "kyc.view");
  if (!decision.allowed) throw new ForbiddenError(APP, "kyc.view", decision.reason);
}

function maskIdNumber(idNumber: string): string {
  return `••••${idNumber.slice(-4)}`;
}

function toSummary(kycCase: IdentityCase): CaseSummary {
  return {
    id: kycCase.id,
    customerName: kycCase.customerName,
    documentType: kycCase.documentType,
    riskScore: kycCase.riskScore,
    status: kycCase.status,
    assignedTo: kycCase.assignedTo,
  };
}

/** kyc.view: the list, without any sensitive field. */
export async function viewCases(
  user: User,
  filter: { status?: CaseStatus } = {},
): Promise<CaseSummary[]> {
  requireView(user);
  return (await listCases(filter)).map(toSummary);
}

/** kyc.view: one case, with the ID number masked unless this user may see it. */
export async function viewCase(user: User, caseId: string): Promise<CaseDetail> {
  requireView(user);
  const kycCase = await getCase(caseId);
  const full = maySeeFullIdNumber(user, kycCase);
  return {
    ...toSummary(kycCase),
    dateOfBirth: kycCase.dateOfBirth,
    idNumber: full ? kycCase.idNumber : maskIdNumber(kycCase.idNumber),
    idNumberMasked: !full,
    notes: kycCase.notes,
    decidedBy: kycCase.decidedBy,
    decidedAt: kycCase.decidedAt,
  };
}

export async function claimKycCase(user: User, caseId: string): Promise<ActionResult> {
  try {
    const kycCase = await getCase(caseId);
    await runAction(user, APP, "kyc.claim", toResource(kycCase), async () => {
      const claimed = await claimCase(kycCase.id, { analyst: user.email });
      return {
        before: { assignedTo: kycCase.assignedTo },
        after: { assignedTo: claimed.assignedTo },
      };
    });
    return {};
  } catch (error) {
    return serviceRefusal(error);
  }
}

async function decide(
  user: User,
  caseId: string,
  action: "kyc.approve" | "kyc.reject" | "kyc.escalate",
  decision: CaseDecision,
  note?: string,
): Promise<ActionResult> {
  try {
    const kycCase = await getCase(caseId);
    await runAction(user, APP, action, toResource(kycCase), async () => {
      const decided = await decideCase(kycCase.id, { decision, by: user.email, note });
      // The note is free text and may quote the document, so it is not audited.
      return {
        before: { status: kycCase.status },
        after: { status: decided.status },
      };
    });
    return {};
  } catch (error) {
    return serviceRefusal(error);
  }
}

export function approveKycCase(user: User, caseId: string): Promise<ActionResult> {
  return decide(user, caseId, "kyc.approve", "approve");
}

export function rejectKycCase(
  user: User,
  caseId: string,
  note: string,
): Promise<ActionResult> {
  return decide(user, caseId, "kyc.reject", "reject", note);
}

export function escalateKycCase(
  user: User,
  caseId: string,
  note: string,
): Promise<ActionResult> {
  return decide(user, caseId, "kyc.escalate", "escalate", note);
}
