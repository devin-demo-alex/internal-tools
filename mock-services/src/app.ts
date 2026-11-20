import Fastify, { type FastifyInstance } from "fastify";

/** A request the service refuses. The message is sent back as `{ error }`. */
export class Refusal extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function createApp(): FastifyInstance {
  const app = Fastify();
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof Refusal) {
      return reply.status(error.status).send({ error: error.message });
    }
    const { statusCode, message } = error as { statusCode?: number; message?: string };
    const status = statusCode && statusCode >= 400 ? statusCode : 500;
    return reply.status(status).send({ error: message ?? "Unexpected error" });
  });
  app.setNotFoundHandler((request, reply) =>
    reply.status(404).send({ error: `No route for ${request.method} ${request.url}` }),
  );
  return app;
}

export function requiredString(body: unknown, field: string): string {
  const value = (body as Record<string, unknown> | null | undefined)?.[field];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Refusal(400, `${field} is required`);
  }
  return value.trim();
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], field: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Refusal(400, `${field} must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
}

export const samePerson = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
