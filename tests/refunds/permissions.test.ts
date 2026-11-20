import { describe, expect, test } from "vitest";
import { TEST_USERS } from "@/platform/auth/test-users";
import { can } from "@/platform/policy";
import { startPaymentsService } from "./helpers";

process.env.AUDIT_DB_PATH = ":memory:";

const { ForbiddenError } = await import("@/platform/actions");
const { getRefund } = await import("@/platform/services/payments");
const { approveRefundRequest, rejectRefundRequest, requestRefund } = await import(
  "@/app/refunds/actions"
);
const { permissions } = await import("@/app/refunds/permissions");

startPaymentsService();

// ref_001 in the fake payments service: requested by Sam, not yet decided.
const SAMS_REFUND = "ref_001";

// Who may do what. Everyone in AGENTS.md who is not listed is refused.
const allowed: Record<string, string[]> = {
  "refunds.view": ["sam@example.test", "pat@example.test", "ravi@example.test"],
  "refunds.request": ["sam@example.test", "pat@example.test"],
  "refunds.approve": ["pat@example.test", "ravi@example.test"],
  "refunds.reject": ["pat@example.test", "ravi@example.test"],
};

test("the app has exactly these four actions", () => {
  expect(Object.keys(permissions).sort()).toEqual(Object.keys(allowed).sort());
});

describe("refunds.view", () => {
  for (const user of TEST_USERS) {
    const expected = allowed["refunds.view"].includes(user.email);
    test(`${user.name} is ${expected ? "allowed" : "refused"}`, () => {
      expect(can(user, permissions, "refunds.view")).toBe(expected);
    });
  }
});

describe("refunds.request", () => {
  for (const user of TEST_USERS) {
    const expected = allowed["refunds.request"].includes(user.email);
    test(`${user.name} is ${expected ? "allowed" : "refused"}`, async () => {
      const call = requestRefund(user, {
        paymentId: "pay_002",
        amountCents: 100,
        reason: "Test request",
      });
      if (expected) {
        const { id } = await call;
        expect((await getRefund(id!)).requestedBy).toBe(user.email);
      } else {
        await expect(call).rejects.toBeInstanceOf(ForbiddenError);
      }
    });
  }
});

describe("refunds.approve, on a refund Sam requested", () => {
  for (const user of TEST_USERS) {
    const expected = allowed["refunds.approve"].includes(user.email);
    test(`${user.name} is ${expected ? "allowed" : "refused"}`, async () => {
      const call = approveRefundRequest(user, SAMS_REFUND);
      if (expected) {
        expect(await call).toEqual({});
        expect(await getRefund(SAMS_REFUND)).toMatchObject({
          status: "approved",
          decidedBy: user.email,
        });
      } else {
        await expect(call).rejects.toBeInstanceOf(ForbiddenError);
        expect((await getRefund(SAMS_REFUND)).status).toBe("requested");
      }
    });
  }
});

describe("refunds.reject, on a refund Sam requested", () => {
  for (const user of TEST_USERS) {
    const expected = allowed["refunds.reject"].includes(user.email);
    test(`${user.name} is ${expected ? "allowed" : "refused"}`, async () => {
      const call = rejectRefundRequest(user, SAMS_REFUND, "Not eligible");
      if (expected) {
        expect(await call).toEqual({});
        expect(await getRefund(SAMS_REFUND)).toMatchObject({
          status: "rejected",
          decidedBy: user.email,
          decisionNote: "Not eligible",
        });
      } else {
        await expect(call).rejects.toBeInstanceOf(ForbiddenError);
        expect((await getRefund(SAMS_REFUND)).status).toBe("requested");
      }
    });
  }
});

describe("the two conditions on approve and reject", () => {
  const ravi = TEST_USERS.find((user) => user.email === "ravi@example.test")!;
  const undecided = { id: "ref_x", status: "requested", requestedBy: "sam@example.test" };

  for (const action of ["refunds.approve", "refunds.reject"]) {
    test(`${action}: allowed while the refund is requested and someone else asked for it`, () => {
      expect(can(ravi, permissions, action, undecided)).toBe(true);
    });

    test(`${action}: refused once the refund is decided`, () => {
      expect(can(ravi, permissions, action, { ...undecided, status: "approved" })).toBe(false);
      expect(can(ravi, permissions, action, { ...undecided, status: "rejected" })).toBe(false);
    });

    test(`${action}: refused on the user's own request`, () => {
      expect(can(ravi, permissions, action, { ...undecided, requestedBy: "ravi@example.test" })).toBe(false);
      expect(can(ravi, permissions, action, { ...undecided, requestedBy: "Ravi@Example.test" })).toBe(false);
    });

    test(`${action}: refused when a field the check reads is missing`, () => {
      expect(can(ravi, permissions, action)).toBe(false);
      expect(can(ravi, permissions, action, { id: "ref_x", requestedBy: "sam@example.test" })).toBe(false);
      expect(can(ravi, permissions, action, { id: "ref_x", status: "requested" })).toBe(false);
    });
  }
});

test("toResource gives the permission check the refund's id, status and requester, and nothing else", async () => {
  const { toResource } = await import("@/app/refunds/actions");
  expect(toResource(await getRefund(SAMS_REFUND))).toEqual({
    type: "refund",
    id: SAMS_REFUND,
    status: "requested",
    requestedBy: "sam@example.test",
  });
});
