import { describe, expect, test } from "vitest";
import type { User } from "@/platform/contracts";
import { authorize, can, type Permissions } from "@/platform/policy";

const agent: User = {
  name: "Sam Agent",
  email: "sam@example.test",
  groups: ["support-agents"],
};
const approver: User = {
  name: "Ravi Approver",
  email: "ravi@example.test",
  groups: ["refund-approvers"],
};

const permissions: Permissions = {
  "refund.request": { groups: ["support-agents"] },
  "refund.approve": {
    groups: ["refund-approvers"],
    when: (user, refund: { requestedBy: string }) =>
      refund.requestedBy !== user.email,
  },
};

describe("authorize", () => {
  test("allows a user in the group", () => {
    expect(authorize(agent, permissions, "refund.request")).toEqual({
      allowed: true,
    });
  });

  test("refuses an unknown action", () => {
    expect(authorize(agent, permissions, "refund.delete")).toEqual({
      allowed: false,
      reason: "unknown-action",
    });
    expect(authorize(agent, {}, "refund.request").allowed).toBe(false);
    expect(authorize(agent, undefined, "refund.request").allowed).toBe(false);
  });

  test("refuses an action name that only exists on the prototype", () => {
    expect(authorize(agent, permissions, "toString").allowed).toBe(false);
    expect(authorize(agent, permissions, "constructor").allowed).toBe(false);
  });

  test("refuses a missing user", () => {
    expect(authorize(null, permissions, "refund.request")).toEqual({
      allowed: false,
      reason: "no-user",
    });
    expect(authorize(undefined, permissions, "refund.request").allowed).toBe(
      false,
    );
  });

  test("refuses a user in the wrong group", () => {
    expect(authorize(agent, permissions, "refund.approve", {})).toEqual({
      allowed: false,
      reason: "not-in-group",
    });
  });

  test("refuses a rule with no groups", () => {
    expect(authorize(agent, { open: { groups: [] } }, "open").allowed).toBe(
      false,
    );
  });

  test("refuses when the condition is false", () => {
    const own = { requestedBy: approver.email };
    expect(authorize(approver, permissions, "refund.approve", own)).toEqual({
      allowed: false,
      reason: "condition-failed",
    });
    const other = { requestedBy: agent.email };
    expect(authorize(approver, permissions, "refund.approve", other)).toEqual({
      allowed: true,
    });
  });

  test("refuses when the condition throws or returns a non-boolean", () => {
    expect(
      authorize(approver, permissions, "refund.approve", undefined).allowed,
    ).toBe(false);
    const truthy: Permissions = {
      act: { groups: ["refund-approvers"], when: () => "yes" as never },
    };
    expect(authorize(approver, truthy, "act").allowed).toBe(false);
  });
});

describe("can", () => {
  test("returns a plain boolean", () => {
    expect(can(agent, permissions, "refund.request")).toBe(true);
    expect(can(agent, permissions, "refund.approve", {})).toBe(false);
    expect(can(null, permissions, "refund.request")).toBe(false);
  });
});
