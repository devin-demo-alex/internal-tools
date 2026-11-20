import { redirect } from "next/navigation";
import { LOGIN_PATH, signOut } from "./current-user";

/** The /logout handler. src/app/logout/route.ts only re-exports it. */
async function logout(request: Request) {
  // A link prefetch must not sign the user out.
  const purpose =
    request.headers.get("sec-purpose") ?? request.headers.get("purpose") ?? "";
  if (purpose.includes("prefetch") || request.headers.has("next-router-prefetch")) {
    return new Response(null, { status: 204 });
  }
  await signOut();
  redirect(LOGIN_PATH);
}

export { logout as GET, logout as POST };
