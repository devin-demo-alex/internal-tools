import type { User } from "@/platform/contracts";
import type { Permissions } from "@/platform/policy";

/** The flag fields the permission check reads. Pass exactly these to runAction and can(). */
export type FlagResource = {
  id: string;
  environment: string;
};

/** Engineers toggle staging flags. Only release-managers toggle production flags. */
function mayToggleInEnvironment(user: User, flag: FlagResource): boolean {
  if (flag?.environment === "staging") return user.groups.includes("engineers");
  if (flag?.environment === "production") return user.groups.includes("release-managers");
  return false;
}

export const permissions: Permissions = {
  "flags.view": { groups: ["engineers", "release-managers"] },
  "flags.toggle": {
    groups: ["engineers", "release-managers"],
    when: mayToggleInEnvironment,
  },
};
