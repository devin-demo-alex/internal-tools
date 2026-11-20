import { request } from "./http";

export { ServiceError } from "./http";

export type Payment = {
  id: string;
  customerName: string;
  amountCents: number;
  currency: string;
  createdAt: string;
};

export type RefundStatus = "requested" | "approved" | "rejected";

export type Refund = {
  id: string;
  paymentId: string;
  amountCents: number;
  reason: string;
  status: RefundStatus;
  requestedBy: string;
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
};

export type CreateRefundInput = {
  paymentId: string;
  amountCents: number;
  reason: string;
  requestedBy: string;
};

const baseUrl = () => process.env.PAYMENTS_SERVICE_URL ?? "http://localhost:4001";
const id = encodeURIComponent;

export function listPayments(): Promise<Payment[]> {
  return request(baseUrl(), "/payments");
}

export function getPayment(paymentId: string): Promise<Payment> {
  return request(baseUrl(), `/payments/${id(paymentId)}`);
}

export function listRefunds(filter: { status?: RefundStatus } = {}): Promise<Refund[]> {
  return request(baseUrl(), "/refunds", { query: { status: filter.status } });
}

export function getRefund(refundId: string): Promise<Refund> {
  return request(baseUrl(), `/refunds/${id(refundId)}`);
}

export function createRefund(input: CreateRefundInput): Promise<Refund> {
  return request(baseUrl(), "/refunds", { method: "POST", body: input });
}

export function approveRefund(refundId: string, input: { approvedBy: string }): Promise<Refund> {
  return request(baseUrl(), `/refunds/${id(refundId)}/approve`, { method: "POST", body: input });
}

export function rejectRefund(refundId: string, input: { rejectedBy: string; note: string }): Promise<Refund> {
  return request(baseUrl(), `/refunds/${id(refundId)}/reject`, { method: "POST", body: input });
}
