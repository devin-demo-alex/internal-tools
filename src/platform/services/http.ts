/** Thrown when a back-end service refuses a request. `message` is the service's own message. */
export class ServiceError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ServiceError";
    this.status = status;
  }
}

export async function request<T>(
  baseUrl: string,
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown; query?: Record<string, string | undefined> } = {},
): Promise<T> {
  const url = new URL(path, baseUrl);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, value);
  }

  const method = options.method ?? "GET";
  const response = await fetch(url, {
    method,
    cache: "no-store",
    ...(method === "POST"
      ? {
          headers: { "content-type": "application/json" },
          body: JSON.stringify(options.body ?? {}),
        }
      : {}),
  });

  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : undefined;
  } catch {
    payload = undefined;
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `${method} ${url.pathname} failed with status ${response.status}`;
    throw new ServiceError(message, response.status);
  }
  return payload as T;
}
