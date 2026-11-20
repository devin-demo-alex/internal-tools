import type { AddressInfo } from "node:net";
import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, expect } from "vitest";
import { ServiceError } from "../../src/platform/services/http";

/** Starts the service on a free port, points the client at it, and resets the data before each test. */
export function startService(build: () => FastifyInstance, envVar: string) {
  const app = build();
  let baseUrl = "";

  beforeAll(async () => {
    await app.listen({ port: 0, host: "127.0.0.1" });
    baseUrl = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
    process.env[envVar] = baseUrl;
  });
  beforeEach(async () => {
    const response = await fetch(`${baseUrl}/__reset`, { method: "POST" });
    expect(response.status).toBe(200);
  });
  afterAll(async () => {
    delete process.env[envVar];
    await app.close();
  });
}

export async function expectRefusal(call: Promise<unknown>, status: number, message: string | RegExp) {
  const error = await call.then(
    () => undefined,
    (thrown: unknown) => thrown,
  );
  expect(error).toBeInstanceOf(ServiceError);
  const refusal = error as ServiceError;
  expect(refusal.status).toBe(status);
  if (typeof message === "string") expect(refusal.message).toBe(message);
  else expect(refusal.message).toMatch(message);
}
