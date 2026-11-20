import { describe, expect, test } from "vitest";
import { listFlags, toggleFlag } from "../../src/platform/services/flags";
import { buildFlagsService } from "../src/flags";
import { expectRefusal, startService } from "./helpers";

startService(buildFlagsService, "FLAGS_SERVICE_URL");

describe("flags", () => {
  test("GET /flags lists the seeded flags across both environments", async () => {
    const flags = await listFlags();
    expect(flags).toHaveLength(8);
    expect(flags.filter((f) => f.environment === "production")).toHaveLength(4);
    expect(flags.filter((f) => f.environment === "staging")).toHaveLength(4);
    expect(flags[0]).toEqual({
      key: "instant-payouts",
      description: "Pay out to merchants within minutes",
      environment: "production",
      enabled: false,
      updatedBy: "mia@example.test",
      updatedAt: "2026-01-10T09:00:00.000Z",
    });
  });

  test("POST /flags/:key/toggle changes the flag in the named environment only", async () => {
    const toggled = await toggleFlag("instant-payouts", { environment: "production", enabled: true, by: "mia@example.test" });
    expect(toggled).toMatchObject({
      key: "instant-payouts",
      environment: "production",
      enabled: true,
      updatedBy: "mia@example.test",
    });
    expect(toggled.updatedAt).not.toBe("2026-01-10T09:00:00.000Z");

    const flags = (await listFlags()).filter((f) => f.key === "instant-payouts");
    expect(flags.find((f) => f.environment === "production")).toEqual(toggled);
    expect(flags.find((f) => f.environment === "staging")).toMatchObject({
      enabled: true,
      updatedBy: "eli@example.test",
      updatedAt: "2026-01-08T13:30:00.000Z",
    });
  });

  test("POST /flags/:key/toggle can turn a flag off", async () => {
    const toggled = await toggleFlag("dark-mode-dashboard", { environment: "staging", enabled: false, by: "eli@example.test" });
    expect(toggled.enabled).toBe(false);
  });

  test("POST /flags/:key/toggle refuses an unknown flag", async () => {
    await expectRefusal(
      toggleFlag("no-such-flag", { environment: "staging", enabled: true, by: "eli@example.test" }),
      404,
      "Flag no-such-flag not found in staging",
    );
  });

  test("POST /flags/:key/toggle refuses a bad environment, a missing enabled and a missing by", async () => {
    await expectRefusal(
      toggleFlag("instant-payouts", { environment: "dev" as never, enabled: true, by: "eli@example.test" }),
      400,
      "environment must be one of: production, staging",
    );
    await expectRefusal(
      toggleFlag("instant-payouts", { environment: "staging", enabled: "yes" as never, by: "eli@example.test" }),
      400,
      "enabled must be true or false",
    );
    await expectRefusal(
      toggleFlag("instant-payouts", { environment: "staging", enabled: true, by: "" }),
      400,
      "by is required",
    );
  });

  test("POST /__reset restores the seed data", async () => {
    await toggleFlag("instant-payouts", { environment: "production", enabled: true, by: "mia@example.test" });

    const response = await fetch(`${process.env.FLAGS_SERVICE_URL}/__reset`, { method: "POST" });
    expect(response.status).toBe(200);

    const flag = (await listFlags()).find((f) => f.key === "instant-payouts" && f.environment === "production");
    expect(flag).toMatchObject({ enabled: false, updatedBy: "mia@example.test", updatedAt: "2026-01-10T09:00:00.000Z" });
  });
});
