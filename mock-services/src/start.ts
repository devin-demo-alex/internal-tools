import { buildFlagsService } from "./flags";
import { buildIdentityService } from "./identity";
import { buildPaymentsService } from "./payments";

const services = [
  { name: "payments", port: 4001, build: buildPaymentsService },
  { name: "identity", port: 4002, build: buildIdentityService },
  { name: "flags", port: 4003, build: buildFlagsService },
];

for (const { name, port, build } of services) {
  await build().listen({ port, host: "localhost" });
  console.log(`${name} service listening on http://localhost:${port}`);
}
