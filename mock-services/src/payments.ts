import type { Payment, Refund, RefundStatus } from "../../src/platform/services/payments";
import { createApp, oneOf, Refusal, requiredString, samePerson } from "./app";

const REFUND_STATUSES: readonly RefundStatus[] = ["requested", "approved", "rejected"];

const payment = (n: number, customerName: string, amountCents: number, currency: string, createdAt: string): Payment => ({
  id: `pay_${String(n).padStart(3, "0")}`,
  customerName,
  amountCents,
  currency,
  createdAt,
});

const seedPayments: Payment[] = [
  payment(1, "Avery Quillfeather", 12500, "USD", "2026-01-05T09:12:00.000Z"),
  payment(2, "Bram Oakenshade", 4999, "USD", "2026-01-06T14:30:00.000Z"),
  payment(3, "Calla Wintermere", 250000, "USD", "2026-01-08T11:45:00.000Z"),
  payment(4, "Dorian Fennimore", 1800, "EUR", "2026-01-09T08:05:00.000Z"),
  payment(5, "Elowen Brightwater", 76000, "GBP", "2026-01-12T16:20:00.000Z"),
  payment(6, "Fitz Marrowby", 3200, "USD", "2026-01-13T10:00:00.000Z"),
  payment(7, "Greta Holloway-Finch", 91500, "EUR", "2026-01-15T13:10:00.000Z"),
  payment(8, "Hollis Tamberlane", 15000, "USD", "2026-01-16T09:40:00.000Z"),
  payment(9, "Isolde Verrick", 600, "GBP", "2026-01-19T17:55:00.000Z"),
  payment(10, "Jasper Underhill", 43000, "USD", "2026-01-20T12:25:00.000Z"),
  payment(11, "Kestrel Moonvale", 8800, "EUR", "2026-01-21T15:00:00.000Z"),
  payment(12, "Lorcan Pebblebrook", 120000, "USD", "2026-01-22T10:35:00.000Z"),
];

const seedRefunds: Refund[] = [
  {
    id: "ref_001",
    paymentId: "pay_001",
    amountCents: 2500,
    reason: "Item arrived damaged",
    status: "requested",
    requestedBy: "sam@example.test",
    requestedAt: "2026-02-02T09:00:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
  },
  {
    id: "ref_002",
    paymentId: "pay_003",
    amountCents: 100000,
    reason: "Customer was charged twice",
    status: "requested",
    requestedBy: "pat@example.test",
    requestedAt: "2026-02-02T10:30:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
  },
  {
    id: "ref_003",
    paymentId: "pay_003",
    amountCents: 50000,
    reason: "Partial order cancelled",
    status: "approved",
    requestedBy: "sam@example.test",
    requestedAt: "2026-01-28T11:00:00.000Z",
    decidedBy: "ravi@example.test",
    decidedAt: "2026-01-29T08:15:00.000Z",
    decisionNote: null,
  },
  {
    id: "ref_004",
    paymentId: "pay_005",
    amountCents: 76000,
    reason: "Service was never delivered",
    status: "approved",
    requestedBy: "sam@example.test",
    requestedAt: "2026-01-27T14:00:00.000Z",
    decidedBy: "pat@example.test",
    decidedAt: "2026-01-27T16:45:00.000Z",
    decisionNote: null,
  },
  {
    id: "ref_005",
    paymentId: "pay_007",
    amountCents: 91500,
    reason: "Customer changed their mind",
    status: "rejected",
    requestedBy: "pat@example.test",
    requestedAt: "2026-01-26T09:30:00.000Z",
    decidedBy: "ravi@example.test",
    decidedAt: "2026-01-26T13:00:00.000Z",
    decisionNote: "Outside the 14-day return window",
  },
  {
    id: "ref_006",
    paymentId: "pay_010",
    amountCents: 4300,
    reason: "Goodwill gesture after a late delivery",
    status: "requested",
    requestedBy: "sam@example.test",
    requestedAt: "2026-02-03T15:20:00.000Z",
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
  },
];

export function buildPaymentsService() {
  let payments: Payment[] = [];
  let refunds: Refund[] = [];
  let nextRefundNumber = 1;

  const reset = () => {
    payments = structuredClone(seedPayments);
    refunds = structuredClone(seedRefunds);
    nextRefundNumber = seedRefunds.length + 1;
  };
  reset();

  const findPayment = (id: string) => {
    const found = payments.find((p) => p.id === id);
    if (!found) throw new Refusal(404, `Payment ${id} not found`);
    return found;
  };
  const findRefund = (id: string) => {
    const found = refunds.find((r) => r.id === id);
    if (!found) throw new Refusal(404, `Refund ${id} not found`);
    return found;
  };
  const requireRequested = (refund: Refund) => {
    if (refund.status !== "requested") {
      throw new Refusal(409, `Refund ${refund.id} is already ${refund.status}`);
    }
  };

  const app = createApp();

  app.post("/__reset", async () => {
    reset();
    return { ok: true };
  });

  app.get("/payments", async () => payments);

  app.get<{ Params: { id: string } }>("/payments/:id", async (request) => findPayment(request.params.id));

  app.get<{ Querystring: { status?: string } }>("/refunds", async (request) => {
    const { status } = request.query;
    if (status === undefined) return refunds;
    const wanted = oneOf(status, REFUND_STATUSES, "status");
    return refunds.filter((r) => r.status === wanted);
  });

  app.get<{ Params: { id: string } }>("/refunds/:id", async (request) => findRefund(request.params.id));

  app.post("/refunds", async (request, reply) => {
    const body = request.body as Record<string, unknown> | undefined;
    const paymentId = requiredString(body, "paymentId");
    const reason = requiredString(body, "reason");
    const requestedBy = requiredString(body, "requestedBy");
    const amountCents = body?.amountCents;
    if (typeof amountCents !== "number" || !Number.isInteger(amountCents) || amountCents <= 0) {
      throw new Refusal(400, "amountCents must be a positive whole number");
    }

    const target = findPayment(paymentId);
    const alreadyApproved = refunds
      .filter((r) => r.paymentId === target.id && r.status === "approved")
      .reduce((sum, r) => sum + r.amountCents, 0);
    const refundable = target.amountCents - alreadyApproved;
    if (amountCents > refundable) {
      throw new Refusal(
        422,
        `Refund of ${amountCents} exceeds the refundable amount of ${refundable} on payment ${target.id}`,
      );
    }

    const refund: Refund = {
      id: `ref_${String(nextRefundNumber++).padStart(3, "0")}`,
      paymentId: target.id,
      amountCents,
      reason,
      status: "requested",
      requestedBy,
      requestedAt: new Date().toISOString(),
      decidedBy: null,
      decidedAt: null,
      decisionNote: null,
    };
    refunds.push(refund);
    return reply.status(201).send(refund);
  });

  app.post<{ Params: { id: string } }>("/refunds/:id/approve", async (request) => {
    const refund = findRefund(request.params.id);
    const approvedBy = requiredString(request.body, "approvedBy");
    requireRequested(refund);
    if (samePerson(approvedBy, refund.requestedBy)) {
      throw new Refusal(403, "A refund cannot be approved by the person who requested it");
    }
    refund.status = "approved";
    refund.decidedBy = approvedBy;
    refund.decidedAt = new Date().toISOString();
    return refund;
  });

  app.post<{ Params: { id: string } }>("/refunds/:id/reject", async (request) => {
    const refund = findRefund(request.params.id);
    const rejectedBy = requiredString(request.body, "rejectedBy");
    const note = requiredString(request.body, "note");
    requireRequested(refund);
    refund.status = "rejected";
    refund.decidedBy = rejectedBy;
    refund.decidedAt = new Date().toISOString();
    refund.decisionNote = note;
    return refund;
  });

  return app;
}
