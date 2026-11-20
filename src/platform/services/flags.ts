import { request } from "./http";

export { ServiceError } from "./http";

export type FlagEnvironment = "production" | "staging";

/** One record per key and environment. */
export type Flag = {
  key: string;
  description: string;
  environment: FlagEnvironment;
  enabled: boolean;
  updatedBy: string;
  updatedAt: string;
};

const baseUrl = () => process.env.FLAGS_SERVICE_URL ?? "http://localhost:4003";

export function listFlags(): Promise<Flag[]> {
  return request(baseUrl(), "/flags");
}

export function toggleFlag(
  key: string,
  input: { environment: FlagEnvironment; enabled: boolean; by: string },
): Promise<Flag> {
  return request(baseUrl(), `/flags/${encodeURIComponent(key)}/toggle`, { method: "POST", body: input });
}
