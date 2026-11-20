import { expect, test, vi } from "vitest";
import type { User } from "@/platform/contracts";
import type { Permissions } from "@/platform/policy";

process.env.AUDIT_DB_PATH = ":memory:";

const { listAudit, recordAudit } = await import("@/platform/audit");
const { ForbiddenError } = await import("@/platform/actions/errors");
const { createRunAction, runAction: platformRunAction } = await import(
  "@/platform/actions/run-action"
);

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
  "refund.approve": {
    groups: ["refund-approvers"],
    when: (_user, refund: { status: string }) => refund.status === "requested",
  },
};

const runAction = createRunAction({
  getPermissions: (app) => (app === "test-app" ? permissions : undefined),
  recordAudit,
});

test("with permission: runs the function and leaves one allowed row and one completed row", async () => {
  const resource = { type: "refund", id: "r-allowed", status: "requested" };
  const fn = vi.fn(async () => ({
    before: { status: "requested" },
    after: { status: "approved" },
    result: "done",
  }));

  const result = await runAction(approver, "test-app", "refund.approve", resource, fn);

  expect(result).toBe("done");
  expect(fn).toHaveBeenCalledTimes(1);
  const [completed, allowed, ...rest] = await listAudit({ resourceId: "r-allowed" });
  expect(rest).toEqual([]);
  const who = {
    actorEmail: "ravi@example.test",
    app: "test-app",
    action: "refund.approve",
    resourceType: "refund",
    resourceId: "r-allowed",
  };
  expect(allowed).toMatchObject({
    ...who,
    outcome: "allowed",
    before: { status: "requested" },
    after: null,
  });
  expect(completed).toMatchObject({
    ...who,
    outcome: "completed",
    before: { status: "requested" },
    after: { status: "approved" },
  });
});

test("the allowed row is written before the function runs", async () => {
  const resource = { type: "refund", id: "r-order", status: "requested" };
  let rowsSeenByFn: string[] = [];

  await runAction(approver, "test-app", "refund.approve", resource, async () => {
    rowsSeenByFn = (await listAudit({ resourceId: "r-order" })).map((e) => e.outcome);
    return {};
  });

  expect(rowsSeenByFn).toEqual(["allowed"]);
});

test("if the first audit write fails, the function never runs", async () => {
  const resource = { type: "refund", id: "r-audit-down", status: "requested" };
  const fn = vi.fn(async () => ({}));
  const failingRecordAudit = vi.fn(async () => {
    throw new Error("audit log is down");
  });
  const runWithBrokenAudit = createRunAction({
    getPermissions: () => permissions,
    recordAudit: failingRecordAudit,
  });

  await expect(
    runWithBrokenAudit(approver, "test-app", "refund.approve", resource, fn),
  ).rejects.toThrow("audit log is down");

  expect(fn).not.toHaveBeenCalled();
  expect(failingRecordAudit).toHaveBeenCalledTimes(1);
});

test("if the denied audit write fails, the function still never runs", async () => {
  const resource = { type: "refund", id: "r-audit-down-denied", status: "requested" };
  const fn = vi.fn(async () => ({}));
  const runWithBrokenAudit = createRunAction({
    getPermissions: () => permissions,
    recordAudit: async () => {
      throw new Error("audit log is down");
    },
  });

  await expect(
    runWithBrokenAudit(agent, "test-app", "refund.approve", resource, fn),
  ).rejects.toThrow("audit log is down");
  expect(fn).not.toHaveBeenCalled();
});

test("without permission: writes exactly one denied entry and does not run the function", async () => {
  const resource = { type: "refund", id: "r-denied", status: "requested" };
  const fn = vi.fn(async () => ({ after: { status: "approved" } }));

  await expect(
    runAction(agent, "test-app", "refund.approve", resource, fn),
  ).rejects.toBeInstanceOf(ForbiddenError);

  expect(fn).not.toHaveBeenCalled();
  const entries = await listAudit({ resourceId: "r-denied" });
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({
    actorEmail: "sam@example.test",
    app: "test-app",
    action: "refund.approve",
    outcome: "denied",
    before: null,
    after: null,
  });
});

test.each([
  ["a false condition", approver, "test-app", "refund.approve", "approved"],
  ["an unknown action", approver, "test-app", "refund.delete", "requested"],
  ["an unknown app", approver, "no-such-app", "refund.approve", "requested"],
  ["a missing user", null, "test-app", "refund.approve", "requested"],
])("refuses %s with one denied entry", async (label, user, app, action, status) => {
  const resource = { type: "refund", id: `r-${label}`, status };
  const fn = vi.fn(async () => ({}));

  await expect(runAction(user, app, action, resource, fn)).rejects.toBeInstanceOf(
    ForbiddenError,
  );

  expect(fn).not.toHaveBeenCalled();
  const entries = await listAudit({ resourceId: resource.id });
  expect(entries).toHaveLength(1);
  expect(entries[0].outcome).toBe("denied");
  expect(entries[0].actorEmail).toBe(user?.email ?? "anonymous");
});

test("a permitted action that throws leaves one allowed row and one failed row, and the error passes through", async () => {
  const resource = { type: "refund", id: "r-throws", status: "requested" };

  await expect(
    runAction(approver, "test-app", "refund.approve", resource, async () => {
      throw new Error("payments service is down");
    }),
  ).rejects.toThrow("payments service is down");

  const [failed, allowed, ...rest] = await listAudit({ resourceId: "r-throws" });
  expect(rest).toEqual([]);
  expect(allowed).toMatchObject({
    outcome: "allowed",
    before: { status: "requested" },
    after: null,
  });
  expect(failed).toMatchObject({
    outcome: "failed",
    after: { error: "payments service is down" },
  });
});

test("the platform runAction denies everything while app permissions are empty", async () => {
  const resource = { type: "refund", id: "r-registry" };
  const fn = vi.fn(async () => ({}));

  await expect(
    platformRunAction(approver, "refunds", "refund.approve", resource, fn),
  ).rejects.toBeInstanceOf(ForbiddenError);

  expect(fn).not.toHaveBeenCalled();
  expect(await listAudit({ resourceId: "r-registry" })).toHaveLength(1);
});
