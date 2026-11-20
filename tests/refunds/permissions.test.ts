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
