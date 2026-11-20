export { guardRequest as proxy } from "@/platform/actions";

// Every page except the sign-in pages and static files.
export const config = {
  matcher: ["/((?!login$|logout$|_next/|favicon\\.ico$).*)"],
};
