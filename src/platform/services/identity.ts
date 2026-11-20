import { request } from "./http";

export { ServiceError } from "./http";

export type CaseStatus = "open" | "approved" | "rejected" | "escalated";
export type CaseDecision = "approve" | "reject" | "escalate";

export type IdentityCase = {
  id: string;
  customerRef: string;
  customerName: string;
  dateOfBirth: string;
  documentType: string;
  idNumber: string;
  /** 0 to 100; higher is riskier. */
  riskScore: number;
  status: CaseStatus;
  assignedTo: string | null;
  notes: string[];
  decidedBy: string | null;
  decidedAt: string | null;
};

const baseUrl = () => process.env.IDENTITY_SERVICE_URL ?? "http://localhost:4002";
const id = encodeURIComponent;

export function listCases(filter: { status?: CaseStatus } = {}): Promise<IdentityCase[]> {
  return request(baseUrl(), "/cases", { query: { status: filter.status } });
}

export function getCase(caseId: string): Promise<IdentityCase> {
  return request(baseUrl(), `/cases/${id(caseId)}`);
}

export function claimCase(caseId: string, input: { analyst: string }): Promise<IdentityCase> {
  return request(baseUrl(), `/cases/${id(caseId)}/claim`, { method: "POST", body: input });
}

export function decideCase(
  caseId: string,
  input: { decision: CaseDecision; by: string; note?: string },
): Promise<IdentityCase> {
  return request(baseUrl(), `/cases/${id(caseId)}/decision`, { method: "POST", body: input });
}
