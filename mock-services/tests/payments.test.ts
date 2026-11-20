import { describe, expect, test } from "vitest";
import {
  approveRefund,
  createRefund,
  getPayment,
  getRefund,
  listPayments,
  listRefunds,
  rejectRefund,
} from "../../src/platform/services/payments";
import { buildPaymentsService } from "../src/payments";
import { expectRefusal, startService } from "./helpers";

startService(buildPaymentsService, "PAYMENTS_SERVICE_URL");

describe("payments", () => {
  test("GET /payments lists the seeded payments", async () => {
    const payments = await listPayments();
    expect(payments).toHaveLength(12);
    expect(payments[0]).toEqual({
      id: "pay_001",
      customerName: "Avery Quillfeather",
      amountCents: 12500,
      currency: "USD",
      createdAt: "2026-01-05T09:12:00.000Z",
    });
  });

  test("GET /payments/:id returns one payment", async () => {
    expect(await getPayment("pay_003")).toMatchObject({ id: "pay_003", amountCents: 250000 });
  });

  test("GET /payments/:id refuses an unknown payment", async () => {
    await expectRefusal(getPayment("pay_999"), 404, "Payment pay_999 not found");
  });
});

describe("refunds", () => {
  test("GET /refunds lists the seeded refunds in mixed states", async () => {
    const refunds = await listRefunds();
    expect(refunds).toHaveLength(6);
    expect(new Set(refunds.map((r) => r.status))).toEqual(new Set(["requested", "approved", "rejected"]));
  });

  test("GET /refunds filters by status", async () => {
    expect((await listRefunds({ status: "requested" })).map((r) => r.id)).toEqual(["ref_001", "ref_002", "ref_006"]);
    expect((await listRefunds({ status: "approved" })).map((r) => r.id)).toEqual(["ref_003", "ref_004"]);
    expect((await listRefunds({ status: "rejected" })).map((r) => r.id)).toEqual(["ref_005"]);
  });

  test("GET /refunds refuses an unknown status", async () => {
    await expectRefusal(listRefunds({ status: "pending" as never }), 400, /^status must be one of/);
  });

  test("GET /refunds/:id returns one refund", async () => {
    expect(await getRefund("ref_005")).toEqual({
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
    });
  });

  test("GET /refunds/:id refuses an unknown refund", async () => {
    await expectRefusal(getRefund("ref_999"), 404, "Refund ref_999 not found");
  });

  test("POST /refunds creates a requested refund", async () => {
    const refund = await createRefund({
      paymentId: "pay_002",
      amountCents: 4999,
      reason: "Wrong size",
      requestedBy: "sam@example.test",
    });
    expect(refund).toMatchObject({
      id: "ref_007",
      paymentId: "pay_002",
      amountCents: 4999,
      reason: "Wrong size",
      status: "requested",
      requestedBy: "sam@example.test",
      decidedBy: null,
      decidedAt: null,
      decisionNote: null,
    });
    expect(Number.isNaN(Date.parse(refund.requestedAt))).toBe(false);
    expect(await getRefund("ref_007")).toEqual(refund);
  });

  test("POST /refunds refuses when the payment does not exist", async () => {
    await expectRefusal(
      createRefund({ paymentId: "pay_999", amountCents: 100, reason: "x", requestedBy: "sam@example.test" }),
      404,
      "Payment pay_999 not found",
    );
    expect(await listRefunds()).toHaveLength(6);
  });

  test("POST /refunds refuses more than the payment amount", async () => {
    await expectRefusal(
      createRefund({ paymentId: "pay_002", amountCents: 5000, reason: "x", requestedBy: "sam@example.test" }),
      422,
      "Refund of 5000 exceeds the refundable amount of 4999 on payment pay_002",
    );
  });

  test("POST /refunds refuses more than the payment amount minus approved refunds", async () => {
    // pay_003 is 250000 with 50000 approved; the 100000 still only requested does not count.
    await expectRefusal(
      createRefund({ paymentId: "pay_003", amountCents: 200001, reason: "x", requestedBy: "sam@example.test" }),
      422,
      "Refund of 200001 exceeds the refundable amount of 200000 on payment pay_003",
    );
    const atTheLimit = await createRefund({
      paymentId: "pay_003",
      amountCents: 200000,
      reason: "Rest of the order",
      requestedBy: "sam@example.test",
    });
    expect(atTheLimit.status).toBe("requested");
  });

  test("POST /refunds counts a refund approved after the start", async () => {
    await approveRefund("ref_001", { approvedBy: "ravi@example.test" });
    await expectRefusal(
      createRefund({ paymentId: "pay_001", amountCents: 10001, reason: "x", requestedBy: "sam@example.test" }),
      422,
      /refundable amount of 10000/,
    );
  });

  test.each([
    ["a missing reason", { reason: "" }, "reason is required"],
    ["a missing requestedBy", { requestedBy: "" }, "requestedBy is required"],
    ["a zero amount", { amountCents: 0 }, "amountCents must be a positive whole number"],
    ["a fractional amount", { amountCents: 10.5 }, "amountCents must be a positive whole number"],
  ])("POST /refunds refuses %s", async (_name, override, message) => {
    await expectRefusal(
      createRefund({ paymentId: "pay_002", amountCents: 100, reason: "x", requestedBy: "sam@example.test", ...override }),
      400,
      message,
    );
  });

  test("POST /refunds/:id/approve approves a requested refund", async () => {
    const refund = await approveRefund("ref_001", { approvedBy: "ravi@example.test" });
    expect(refund).toMatchObject({ id: "ref_001", status: "approved", decidedBy: "ravi@example.test", decisionNote: null });
    expect(refund.decidedAt).not.toBeNull();
    expect(await getRefund("ref_001")).toEqual(refund);
  });

  test.each([
    ["approved", "ref_003"],
    ["rejected", "ref_005"],
  ])("POST /refunds/:id/approve refuses a refund that is already %s", async (status, id) => {
    await expectRefusal(approveRefund(id, { approvedBy: "ada@example.test" }), 409, `Refund ${id} is already ${status}`);
  });

  test("POST /refunds/:id/approve refuses the person who requested the refund", async () => {
    const message = "A refund cannot be approved by the person who requested it";
    await expectRefusal(approveRefund("ref_002", { approvedBy: "pat@example.test" }), 403, message);
    await expectRefusal(approveRefund("ref_002", { approvedBy: " Pat@Example.test " }), 403, message);
    expect((await getRefund("ref_002")).status).toBe("requested");
  });

  test("POST /refunds/:id/approve refuses an unknown refund and a missing approvedBy", async () => {
    await expectRefusal(approveRefund("ref_999", { approvedBy: "ravi@example.test" }), 404, "Refund ref_999 not found");
    await expectRefusal(approveRefund("ref_001", { approvedBy: "" }), 400, "approvedBy is required");
  });

  test("POST /refunds/:id/reject rejects a requested refund and keeps the note", async () => {
    const refund = await rejectRefund("ref_006", { rejectedBy: "ravi@example.test", note: "Delivery was on time" });
    expect(refund).toMatchObject({
      id: "ref_006",
      status: "rejected",
      decidedBy: "ravi@example.test",
      decisionNote: "Delivery was on time",
    });
    expect(refund.decidedAt).not.toBeNull();
    expect(await getRefund("ref_006")).toEqual(refund);
  });

  test.each([
    ["approved", "ref_004"],
    ["rejected", "ref_005"],
  ])("POST /refunds/:id/reject refuses a refund that is already %s", async (status, id) => {
    await expectRefusal(
      rejectRefund(id, { rejectedBy: "ravi@example.test", note: "No" }),
      409,
      `Refund ${id} is already ${status}`,
    );
  });

  test("POST /refunds/:id/reject refuses an unknown refund, a missing rejectedBy and a missing note", async () => {
    await expectRefusal(rejectRefund("ref_999", { rejectedBy: "ravi@example.test", note: "No" }), 404, "Refund ref_999 not found");
    await expectRefusal(rejectRefund("ref_001", { rejectedBy: "", note: "No" }), 400, "rejectedBy is required");
    await expectRefusal(rejectRefund("ref_001", { rejectedBy: "ravi@example.test", note: "" }), 400, "note is required");
  });

  test("POST /__reset restores the seed data", async () => {
    await createRefund({ paymentId: "pay_002", amountCents: 100, reason: "x", requestedBy: "sam@example.test" });
    await approveRefund("ref_001", { approvedBy: "ravi@example.test" });
    const before = await listRefunds();
    expect(before).toHaveLength(7);

    const response = await fetch(`${process.env.PAYMENTS_SERVICE_URL}/__reset`, { method: "POST" });
    expect(response.status).toBe(200);

    const after = await listRefunds();
    expect(after).toHaveLength(6);
    expect((await getRefund("ref_001")).status).toBe("requested");
    const next = await createRefund({ paymentId: "pay_002", amountCents: 100, reason: "x", requestedBy: "sam@example.test" });
    expect(next.id).toBe("ref_007");
  });
});
