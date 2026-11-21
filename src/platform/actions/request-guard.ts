import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/platform/auth";
import type { User } from "@/platform/contracts";
import { apps, canOpenApp, pageExists } from "@/platform/registry";
import { BRAND } from "@/platform/ui/brand";

const LOGIN_PATH = "/login";

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );

// A page that has started to stream cannot change its status, so a refusal is
// a complete response of its own, with the same words as src/app/forbidden.tsx
// and the same letterhead as the page frame.
function refusal(
  user: User,
  status: number,
  title: string,
  message: string,
): Response {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>${title} | ${BRAND.company}</title>
    <link rel="icon" href="/icon.svg" type="image/svg+xml" />
    <style>
      body { margin: 0; min-height: 100vh; display: flex; flex-direction: column; font-family: system-ui, sans-serif; font-size: 0.875rem; line-height: 1.5; color: #171717; }
      a { color: inherit; }
      header { display: flex; height: 3.5rem; flex-shrink: 0; align-items: center; justify-content: space-between; gap: 1rem; padding: 0 1rem; border-bottom: 1px solid #e5e5e5; white-space: nowrap; }
      .brand { display: flex; align-items: center; gap: 0.625rem; font-weight: 600; text-decoration: none; }
      .brand img { width: 1.75rem; height: 1.75rem; }
      .product { padding-left: 0.625rem; border-left: 1px solid #e5e5e5; font-weight: 400; color: #737373; }
      .user { display: flex; align-items: center; gap: 1rem; }
      .user span { font-weight: 500; }
      .user a, footer { color: #737373; }
      .user a { text-decoration: none; }
      main { flex: 1; padding: 1.5rem; font-size: 1rem; }
      h1 { margin: 0; font-size: 1.5rem; font-weight: 600; }
      p { margin: 0; }
      footer { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 0.25rem 1rem; padding: 0.75rem 1rem; border-top: 1px solid #e5e5e5; font-size: 0.75rem; }
      @media (max-width: 40rem) { .product, .user span { display: none; } }
    </style>
  </head>
  <body>
    <header>
      <a class="brand" href="/">
        <img src="/icon.svg" alt="" />
        ${BRAND.company}
        <span class="product">${BRAND.product}</span>
      </a>
      <div class="user">
        <span title="${escapeHtml(user.email)}">${escapeHtml(user.name)}</span>
        <a href="/logout">Sign out</a>
      </div>
    </header>
    <main>
      <h1>${title}</h1>
      <p>${message}</p>
      <a href="/">Back to home</a>
    </main>
    <footer>
      <span>${BRAND.company} · ${BRAND.product}</span>
      <span>${BRAND.notice}</span>
    </footer>
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
      user,
      403,
      "403: Not allowed",
      "You do not have permission to see this page or do this action.",
    );
  }
  if (app && !(await pageExists(app, pathname))) {
    return refusal(user, 404, "404: Not found", "This page does not exist.");
  }
  return NextResponse.next();
}
