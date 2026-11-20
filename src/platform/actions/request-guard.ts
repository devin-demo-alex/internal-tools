import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/platform/auth";
import { apps, canOpenApp } from "@/platform/registry";

const LOGIN_PATH = "/login";

// A page that has started to stream cannot change its status, so this refusal
// is a complete response of its own, with the same words as src/app/forbidden.tsx.
const FORBIDDEN_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>403: Not allowed</title>
    <style>
      body { margin: 0; padding: 2rem; font-family: system-ui, sans-serif; line-height: 1.5; }
      h1 { margin: 0; font-size: 1.5rem; font-weight: 600; }
      p { margin: 0; }
    </style>
  </head>
  <body>
    <main>
      <h1>403: Not allowed</h1>
      <p>You do not have permission to see this page or do this action.</p>
      <a href="/">Back to home</a>
    </main>
  </body>
</html>
`;

/**
 * Runs before a page starts to stream, so a refusal has a real status code:
 * a redirect for a signed-out visitor, and 403 for an app the user may not open.
 * The pages keep their own checks.
 */
export async function guardRequest(request: NextRequest): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL(LOGIN_PATH, request.url));

  const { pathname } = request.nextUrl;
  const app = apps.find(
    ({ path }) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (app && !canOpenApp(user, app)) {
    return new Response(FORBIDDEN_HTML, {
      status: 403,
      headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
    });
  }
  return NextResponse.next();
}
