import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/platform/auth";
import { apps, canOpenApp, pageExists } from "@/platform/registry";

const LOGIN_PATH = "/login";

// A page that has started to stream cannot change its status, so a refusal is
// a complete response of its own, with the same words as src/app/forbidden.tsx.
function refusal(status: number, title: string, message: string): Response {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${title}</title>
    <style>
      body { margin: 0; padding: 2rem; font-family: system-ui, sans-serif; line-height: 1.5; }
      h1 { margin: 0; font-size: 1.5rem; font-weight: 600; }
      p { margin: 0; }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${message}</p>
      <a href="/">Back to home</a>
    </main>
  </body>
</html>
`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

/**
 * Runs before a page starts to stream, so a refusal has a real status code:
 * a redirect for a signed-out visitor, 403 for an app the user may not open, and
 * 404 for something in an app that does not exist. A signed-in visitor never
 * gets the login page. The pages keep their own checks.
 */
export async function guardRequest(request: NextRequest): Promise<Response> {
  const user = await getCurrentUser();
  const { pathname } = request.nextUrl;
  if (pathname === LOGIN_PATH) {
    // The sign-in form posts to this path, so only a page view is sent home.
    return user && request.method === "GET"
      ? NextResponse.redirect(new URL("/", request.url))
      : NextResponse.next();
  }
  if (!user) return NextResponse.redirect(new URL(LOGIN_PATH, request.url));

  const app = apps.find(
    ({ path }) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (app && !canOpenApp(user, app)) {
    return refusal(
      403,
      "403: Not allowed",
      "You do not have permission to see this page or do this action.",
    );
  }
  if (app && !(await pageExists(app, pathname))) {
    return refusal(404, "404: Not found", "This page does not exist.");
  }
  return NextResponse.next();
}
