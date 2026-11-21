import { runAction } from "@/platform/actions";
import type { User } from "@/platform/contracts";
import {
  listFlags,
  ServiceError,
  toggleFlag,
  type FlagEnvironment,
} from "@/platform/services/flags";
import type { FlagResource } from "./permissions";

// The action takes the signed-in user from the page, never from the browser.
// A refusal by the permission check is thrown as ForbiddenError.
// A refusal by the flags service is returned as { error } for the page to show.

export type ActionResult = { error?: string };

const APP = "flags";

/**
 * The one place a flag is turned into what the permission check reads.
 * The action passes it to runAction and the list page passes it to can().
 * Only the field the check needs: runAction stores it in the audit log.
 * One record per key and environment, so the id names both.
 */
export function toResource(flag: {
  key: string;
  environment: FlagEnvironment;
}): { type: "flag" } & FlagResource {
  return {
    type: "flag",
    id: `${flag.key}:${flag.environment}`,
    environment: flag.environment,
  };
}

function serviceRefusal(error: unknown): ActionResult {
  if (error instanceof ServiceError) return { error: error.message };
  throw error;
}

export async function toggleFeatureFlag(
  user: User,
  input: { key: string; environment: FlagEnvironment; enabled: boolean },
): Promise<ActionResult> {
  try {
    await runAction(user, APP, "flags.toggle", toResource(input), async () => {
      const flags = await listFlags();
      const current = flags.find(
        (flag) => flag.key === input.key && flag.environment === input.environment,
      );
      const toggled = await toggleFlag(input.key, {
        environment: input.environment,
        enabled: input.enabled,
        by: user.email,
      });
      return {
        before: { enabled: current?.enabled },
        after: { enabled: toggled.enabled },
      };
    });
    return {};
  } catch (error) {
    return serviceRefusal(error);
  }
}
