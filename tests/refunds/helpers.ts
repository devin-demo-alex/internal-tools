import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach } from "vitest";
import { buildPaymentsService } from "../../mock-services/src/payments";

/** Starts the fake payments service on a free port, points the client at it, and resets its data before each test. */
export function startPaymentsService() {
  const service = buildPaymentsService();
  let baseUrl = "";

  beforeAll(async () => {
    await service.listen({ port: 0, host: "127.0.0.1" });
    baseUrl = `http://127.0.0.1:${(service.server.address() as AddressInfo).port}`;
    process.env.PAYMENTS_SERVICE_URL = baseUrl;
  });
  beforeEach(async () => {
    await fetch(`${baseUrl}/__reset`, { method: "POST" });
  });
  afterAll(async () => {
    delete process.env.PAYMENTS_SERVICE_URL;
    await service.close();
  });
}
