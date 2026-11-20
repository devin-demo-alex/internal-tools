import type { User } from "@/platform/contracts";

export type PermissionRule = {
  /** The user must be in at least one of these groups. */
  groups: string[];
  /** Optional extra condition. The action is refused unless it returns true. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each app narrows the resource type per action
  when?: (user: User, resource: any) => boolean;
};

export type Permissions = Record<string, PermissionRule>;

export type DenyReason =
  | "no-user"
  | "unknown-action"
  | "not-in-group"
  | "condition-failed";

export type Decision =
  | { allowed: true }
  | { allowed: false; reason: DenyReason };

function deny(reason: DenyReason): Decision {
  return { allowed: false, reason };
}

/** Deny by default: only an explicit, fully satisfied rule allows an action. */
export function authorize(
  user: User | null | undefined,
  permissions: Permissions | null | undefined,
  action: string,
  resource?: unknown,
): Decision {
  if (!user) return deny("no-user");
  if (!permissions || !Object.hasOwn(permissions, action)) {
    return deny("unknown-action");
  }
  const rule = permissions[action];
  if (!rule || !Array.isArray(rule.groups)) return deny("unknown-action");
  if (!rule.groups.some((group) => user.groups.includes(group))) {
    return deny("not-in-group");
  }
  if (rule.when) {
    let ok = false;
    try {
      ok = rule.when(user, resource) === true;
    } catch {
      ok = false;
    }
    if (!ok) return deny("condition-failed");
  }
  return { allowed: true };
}

/** For pages that hide a button. Never the enforcement: runAction is. */
export function can(
  user: User | null | undefined,
  permissions: Permissions | null | undefined,
  action: string,
  resource?: unknown,
): boolean {
  return authorize(user, permissions, action, resource).allowed;
}
