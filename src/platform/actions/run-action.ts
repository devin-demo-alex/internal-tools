import { recordAudit, type AuditInput } from "@/platform/audit";
import type { User } from "@/platform/contracts";
import { authorize, type Permissions } from "@/platform/policy";
import { getPermissions } from "@/platform/registry";
import { ForbiddenError } from "./errors";

/** What an action acts on. Extra fields are available to `when` conditions. */
export type ActionResource = { type: string; id: string } & Record<
  string,
  unknown
>;

/** What the action function returns: the audited values and its own result. */
export type ActionOutput<T> = {
  before?: unknown;
  after?: unknown;
  result?: T;
  /** Optional. The id of what the action created, for the completed row. */
  resourceId?: string;
};

export type RunAction = <T = void>(
  user: User | null | undefined,
  app: string,
  action: string,
  resource: ActionResource,
  fn: () => Promise<ActionOutput<T>> | ActionOutput<T>,
) => Promise<T | undefined>;

/** The resource's fields other than type and id: its state before the action. */
function stateOf(resource: ActionResource): Record<string, unknown> | undefined {
  const fields = Object.entries(resource).filter(
    ([key]) => key !== "type" && key !== "id",
  );
  return fields.length > 0 ? Object.fromEntries(fields) : undefined;
}

type Dependencies = {
  getPermissions: (app: string) => Permissions | undefined;
  recordAudit: (event: AuditInput) => Promise<unknown>;
};

export function createRunAction(deps: Dependencies): RunAction {
  return async function runAction(user, app, action, resource, fn) {
    const entry = {
      actorEmail: user?.email ?? "anonymous",
      app,
      action,
      resourceType: resource.type,
      resourceId: resource.id,
    };

    const decision = authorize(user, deps.getPermissions(app), action, resource);
    if (!decision.allowed) {
      await deps.recordAudit({ ...entry, outcome: "denied" });
      throw new ForbiddenError(app, action, decision.reason);
    }

    // Fail closed: if this write throws, the action never runs.
    await deps.recordAudit({
      ...entry,
      outcome: "allowed",
      before: stateOf(resource),
    });

    let output: ActionOutput<unknown>;
    try {
      output = await fn();
    } catch (error) {
      try {
        await deps.recordAudit({
          ...entry,
          outcome: "failed",
          after: { error: error instanceof Error ? error.message : String(error) },
        });
      } catch {
        // The allowed row is already on the record; report the action's own error.
      }
      throw error;
    }

    await deps.recordAudit({
      ...entry,
      outcome: "completed",
      // Something the action created has no id until now.
      resourceId: output?.resourceId ?? resource.id,
      before: output?.before,
      after: output?.after,
    });
    return output?.result as never;
  };
}

/** The only way an app performs an action. */
export const runAction: RunAction = createRunAction({
  getPermissions,
  recordAudit,
});
