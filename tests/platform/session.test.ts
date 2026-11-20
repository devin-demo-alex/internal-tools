import { expect, test } from "vitest";

process.env.SESSION_SECRET = "unit-test-signing-key";

const { createSessionToken, readSessionToken, SESSION_MAX_AGE_SECONDS } =
  await import("@/platform/auth/session");

const NOW = 1_800_000_000_000;

test("a signed token round-trips", () => {
  const token = createSessionToken("sam@example.test", NOW);
  expect(readSessionToken(token, NOW + 1000)).toBe("sam@example.test");
});

test("a tampered or unsigned token is rejected", () => {
  const token = createSessionToken("sam@example.test", NOW);
  const [, signature] = token.split(".");
  const forgedBody = Buffer.from(
    JSON.stringify({ email: "ada@example.test", exp: NOW + 60_000 }),
  ).toString("base64url");

  expect(readSessionToken(`${forgedBody}.${signature}`, NOW)).toBeNull();
  expect(readSessionToken(forgedBody, NOW)).toBeNull();
  expect(readSessionToken(`${token}x`, NOW)).toBeNull();
  expect(readSessionToken("", NOW)).toBeNull();
  expect(readSessionToken(undefined, NOW)).toBeNull();
});

test("an expired token is rejected", () => {
  const token = createSessionToken("sam@example.test", NOW);
  const expiry = NOW + SESSION_MAX_AGE_SECONDS * 1000;
  expect(readSessionToken(token, expiry - 1)).toBe("sam@example.test");
  expect(readSessionToken(token, expiry)).toBeNull();
});
