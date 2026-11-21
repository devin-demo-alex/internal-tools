import { refresh } from "next/cache";
import { forbidden } from "next/navigation";

import {
  forbiddenPageOnDenied,
  requireAppAccess,
} from "@/platform/actions";
import { requireUser } from "@/platform/auth";
import { can } from "@/platform/policy";
import { listFlags, type FlagEnvironment } from "@/platform/services/flags";

import { toggleFeatureFlag, toResource } from "./actions";
import { EnvironmentFilter } from "./components/environment-filter";
import { FlagsTable, type FlagRow, type ToggleInput } from "./components/flags-table";
import { permissions } from "./permissions";

// Who may see this page is decided per request, so navigation waits for the server.
export const instant = false;

const ENVIRONMENTS: FlagEnvironment[] = ["production", "staging"];

async function toggleAction(input: ToggleInput) {
  "use server";
  const user = await requireUser();
  const outcome = await forbiddenPageOnDenied(() => toggleFeatureFlag(user, input));
  if (!outcome.error) refresh();
  return outcome;
}

export default async function FlagsPage({
  searchParams,
}: {
  searchParams: Promise<{ environment?: string | string[] }>;
}) {
  const user = await requireAppAccess("flags");
  if (!can(user, permissions, "flags.view")) forbidden();

  const { environment: wanted } = await searchParams;
  const environment = ENVIRONMENTS.find((candidate) => candidate === wanted);
  const flags = await listFlags();

  const rows: FlagRow[] = flags
    .filter((flag) => environment === undefined || flag.environment === environment)
    .map((flag) => ({
      key: flag.key,
      description: flag.description,
      environment: flag.environment,
      enabled: flag.enabled,
      updatedBy: flag.updatedBy,
      updatedAt: flag.updatedAt,
      // Built the same way as for runAction, so the button matches the server check.
      canToggle: can(user, permissions, "flags.toggle", toResource(flag)),
    }));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Feature flags</h1>
      <EnvironmentFilter environment={environment} />
      <FlagsTable rows={rows} toggle={toggleAction} />
    </div>
  );
}
