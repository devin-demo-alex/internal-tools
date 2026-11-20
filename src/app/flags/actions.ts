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

/** One record per key and environment, so the id names both. */
export function flagId(key: string, environment: string): string {
  return `${key}:${environment}`;
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
    // Only the fields the permission check needs: this is stored in the audit log.
    const resource: { type: "flag" } & FlagResource = {
      type: "flag",
      id: flagId(input.key, input.environment),
      environment: input.environment,
    };
    await runAction(user, APP, "flags.toggle", resource, async () => {
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
