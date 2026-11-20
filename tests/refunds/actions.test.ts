import { expect, test } from "vitest";
import type { User } from "@/platform/contracts";
import { startPaymentsService } from "./helpers";

process.env.AUDIT_DB_PATH = ":memory:";

const { ForbiddenError } = await import("@/platform/actions");
const { listAudit } = await import("@/platform/audit");
const { getRefund, listRefunds } = await import("@/platform/services/payments");
const { approveRefundRequest, rejectRefundRequest, requestRefund } = await import(
  "@/app/refunds/actions"
);

startPaymentsService();

const sam: User = { name: "Sam Agent", email: "sam@example.test", groups: ["support-agents"] };
const pat: User = {
  name: "Pat Both",
  email: "pat@example.test",
  groups: ["support-agents", "refund-approvers"],
};
const ravi: User = { name: "Ravi Approver", email: "ravi@example.test", groups: ["refund-approvers"] };

// pay_002 in the fake payments service has no refunds yet. The service's data is reset
// before each test, so refund ids repeat: audit lookups also name the actor.
const request = { paymentId: "pay_002", amountCents: 500, reason: "Wrong size delivered" };

test("Pat creates a request, is refused when approving it, and then Ravi approves it", async () => {
  const { id } = await requestRefund(pat, request);
  expect(id).toBeDefined();
  const created = await getRefund(id!);
  expect(created).toMatchObject({ ...request, status: "requested", requestedBy: "pat@example.test" });

  // Pat is a refund-approver, but never for a request Pat made.
  await expect(approveRefundRequest(pat, id!)).rejects.toBeInstanceOf(ForbiddenError);
  await expect(rejectRefundRequest(pat, id!, "Changed my mind")).rejects.toBeInstanceOf(ForbiddenError);

  expect(await getRefund(id!)).toEqual(created);
  const afterPat = await listAudit({
    resourceId: id!,
    action: "refunds.approve",
    actorEmail: "pat@example.test",
  });
  expect(afterPat).toHaveLength(1);
  expect(afterPat[0]).toMatchObject({
    actorEmail: "pat@example.test",
    app: "refunds",
    resourceType: "refund",
    outcome: "denied",
    before: null,
    after: null,
  });

  expect(await approveRefundRequest(ravi, id!)).toEqual({});

  expect(await getRefund(id!)).toMatchObject({ status: "approved", decidedBy: "ravi@example.test" });
  const byRavi = await listAudit({
    resourceId: id!,
    action: "refunds.approve",
    actorEmail: "ravi@example.test",
  });
  expect(byRavi.map((entry) => entry.outcome).sort()).toEqual(["allowed", "completed"]);
  const allowed = byRavi.find((entry) => entry.outcome === "allowed");
  const completed = byRavi.find((entry) => entry.outcome === "completed");
  // Only the fields the permission check needs, and only the field that changed.
  expect(allowed?.before).toEqual({ status: "requested", requestedBy: "pat@example.test", amount: 500 });
  expect(completed?.before).toEqual({ status: "requested" });
  expect(completed?.after).toEqual({ status: "approved" });
});

test("a request for more than the payment amount returns the service's error", async () => {
  const before = await listRefunds();

  // pay_002 is a payment of 4,999 cents.
  const outcome = await requestRefund(sam, { ...request, amountCents: 5000 });

  expect(outcome).toEqual({
    error: "Refund of 5000 exceeds the refundable amount of 4999 on payment pay_002",
  });
  expect(await listRefunds()).toEqual(before);
  const [failed, allowed] = await listAudit({ actorEmail: "sam@example.test", action: "refunds.request" });
  expect(allowed.outcome).toBe("allowed");
  expect(failed).toMatchObject({ outcome: "failed", after: { error: outcome.error } });
});

test("a request writes only the new refund's id, payment, amount and status to the audit log", async () => {
  const { id } = await requestRefund(sam, request);

  const [completed] = await listAudit({ actorEmail: "sam@example.test", outcome: "completed", limit: 1 });
  expect(completed).toMatchObject({ action: "refunds.request", resourceType: "refund", resourceId: "new" });
  expect(completed.after).toEqual({ id, paymentId: "pay_002", amount: 500, status: "requested" });
});

test("Ravi rejects a request with a note", async () => {
  const { id } = await requestRefund(sam, request);

  expect(await rejectRefundRequest(ravi, id!, "Outside the return window")).toEqual({});

  expect(await getRefund(id!)).toMatchObject({
    status: "rejected",
    decidedBy: "ravi@example.test",
    decisionNote: "Outside the return window",
  });
  const [completed, allowed, ...rest] = await listAudit({
    resourceId: id!,
    action: "refunds.reject",
    actorEmail: "ravi@example.test",
  });
  expect(rest).toEqual([]);
  expect(allowed.outcome).toBe("allowed");
  expect(completed).toMatchObject({
    outcome: "completed",
    before: { status: "requested" },
    after: { status: "rejected" },
  });
});

test("a refund that is already decided shows the service's error", async () => {
  // ref_003 is already approved.
  expect(await approveRefundRequest(ravi, "ref_003")).toEqual({ error: "Refund ref_003 is already approved" });
});
