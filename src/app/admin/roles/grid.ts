import type { Permissions } from "@/platform/policy";

export type RolesGridRow = {
  action: string;
  /** True when the rule has a `when` condition on top of the group check. */
  hasCondition: boolean;
  /** For each group in `groups`, whether the rule lists it. */
  allowed: Record<string, boolean>;
};

export type RolesGrid = { groups: string[]; rows: RolesGridRow[] };

/**
 * Actions against groups for one app, for display only. The columns are the
 * app's open groups followed by any other group a rule names.
 */
export function buildRolesGrid(
  permissions: Permissions | undefined,
  openGroups: string[] = [],
): RolesGrid {
  const rules = Object.entries(permissions ?? {});
  const groups = [
    ...new Set([...openGroups, ...rules.flatMap(([, rule]) => rule.groups)]),
  ];
  return {
    groups,
    rows: rules.map(([action, rule]) => ({
      action,
      hasCondition: typeof rule.when === "function",
      allowed: Object.fromEntries(
        groups.map((group) => [group, rule.groups.includes(group)]),
      ),
    })),
  };
}
