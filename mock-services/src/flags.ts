import type { Flag, FlagEnvironment } from "../../src/platform/services/flags";
import { createApp, oneOf, Refusal, requiredString } from "./app";

const ENVIRONMENTS: readonly FlagEnvironment[] = ["production", "staging"];

const flag = (
  key: string,
  description: string,
  environment: FlagEnvironment,
  enabled: boolean,
  updatedBy: string,
  updatedAt: string,
): Flag => ({ key, description, environment, enabled, updatedBy, updatedAt });

const seedFlags: Flag[] = [
  flag("instant-payouts", "Pay out to merchants within minutes", "production", false, "mia@example.test", "2026-01-10T09:00:00.000Z"),
  flag("instant-payouts", "Pay out to merchants within minutes", "staging", true, "eli@example.test", "2026-01-08T13:30:00.000Z"),
  flag("new-onboarding-flow", "Shorter sign-up with document upload first", "production", true, "mia@example.test", "2026-01-12T11:15:00.000Z"),
  flag("new-onboarding-flow", "Shorter sign-up with document upload first", "staging", true, "eli@example.test", "2026-01-05T10:00:00.000Z"),
  flag("refund-auto-approve", "Approve refunds under a small amount without review", "production", false, "mia@example.test", "2026-01-14T15:45:00.000Z"),
  flag("refund-auto-approve", "Approve refunds under a small amount without review", "staging", false, "eli@example.test", "2026-01-14T15:40:00.000Z"),
  flag("dark-mode-dashboard", "Dark colour scheme for the merchant dashboard", "production", false, "eli@example.test", "2026-01-18T08:20:00.000Z"),
  flag("dark-mode-dashboard", "Dark colour scheme for the merchant dashboard", "staging", true, "eli@example.test", "2026-01-17T16:05:00.000Z"),
];

export function buildFlagsService() {
  let flags: Flag[] = [];
  const reset = () => {
    flags = structuredClone(seedFlags);
  };
  reset();

  const app = createApp();

  app.post("/__reset", async () => {
    reset();
    return { ok: true };
  });

  app.get("/flags", async () => flags);

  app.post<{ Params: { key: string } }>("/flags/:key/toggle", async (request) => {
    const body = request.body as Record<string, unknown> | undefined;
    const environment = oneOf(body?.environment, ENVIRONMENTS, "environment");
    const by = requiredString(body, "by");
    if (typeof body?.enabled !== "boolean") {
      throw new Refusal(400, "enabled must be true or false");
    }
    const found = flags.find((f) => f.key === request.params.key && f.environment === environment);
    if (!found) throw new Refusal(404, `Flag ${request.params.key} not found in ${environment}`);
    found.enabled = body.enabled;
    found.updatedBy = by;
    found.updatedAt = new Date().toISOString();
    return found;
  });

  return app;
}
