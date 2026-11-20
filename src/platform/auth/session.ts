import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export const SESSION_COOKIE = "it_session";
export const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60;

type SessionPayload = { email: string; exp: number };

let cachedSecret: string | undefined;

// The signing key is never in code: it comes from SESSION_SECRET, or is
// generated once and kept in a git-ignored file.
function getSecret(): string {
  if (cachedSecret) return cachedSecret;
  if (process.env.SESSION_SECRET) {
    cachedSecret = process.env.SESSION_SECRET;
    return cachedSecret;
  }
  const file = path.join(process.cwd(), ".data", "session-secret");
  try {
    cachedSecret = readFileSync(file, "utf8").trim();
  } catch {
    mkdirSync(path.dirname(file), { recursive: true });
    try {
      writeFileSync(file, randomBytes(32).toString("hex"), {
        flag: "wx",
        mode: 0o600,
      });
    } catch {
      // Another process created it first.
    }
    cachedSecret = readFileSync(file, "utf8").trim();
  }
  if (!cachedSecret) throw new Error("Session signing key is empty");
  return cachedSecret;
}

function sign(body: string): string {
  return createHmac("sha256", getSecret()).update(body).digest("base64url");
}

// `now` is a parameter so that this file never reads the clock itself.
export function createSessionToken(email: string, now: number): string {
  const payload: SessionPayload = {
    email,
    exp: now + SESSION_MAX_AGE_SECONDS * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readSessionToken(
  token: string | undefined,
  now: number,
): string | null {
  if (!token) return null;
  const [body, signature, ...rest] = token.split(".");
  if (!body || !signature || rest.length > 0) return null;
  const expected = Buffer.from(sign(body));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return null;
  }
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as Partial<SessionPayload>;
    if (typeof payload.email !== "string") return null;
    if (typeof payload.exp !== "number" || payload.exp <= now) return null;
    return payload.email;
  } catch {
    return null;
  }
}
