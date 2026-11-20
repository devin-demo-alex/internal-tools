import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "vitest";

const SRC = path.join(process.cwd(), "src");
const AUTH = path.join(SRC, "platform", "auth");

// The two files that give the sign-in pages their URLs. Each is one re-export.
const ROUTE_FILES = new Map([
  [path.join(SRC, "app", "login", "page.tsx"), "@/platform/auth/login-page"],
  [path.join(SRC, "app", "logout", "route.ts"), "@/platform/auth/logout-route"],
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return full === AUTH ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "").trim();
}

test("the auth module exports only getCurrentUser and requireUser", async () => {
  process.env.SESSION_SECRET = "unit-test-signing-key";
  const auth = await import("@/platform/auth");
  expect(Object.keys(auth).sort()).toEqual(["getCurrentUser", "requireUser"]);
});

test("code outside the auth folder imports only the auth module itself", () => {
  const offenders = sourceFiles(SRC)
    .filter((file) => !ROUTE_FILES.has(file))
    .filter((file) => /platform\/auth\/|it_session/.test(readFileSync(file, "utf8")))
    .map((file) => path.relative(SRC, file));
  expect(offenders).toEqual([]);
});

test("the login and logout route files are single re-exports", () => {
  for (const [file, target] of ROUTE_FILES) {
    const code = withoutComments(readFileSync(file, "utf8"));
    expect(code).toMatch(
      new RegExp(`^export \\{ [A-Za-z, ]+ \\} from "${target}";$`),
    );
  }
});
