export { guardRequest as proxy } from "@/platform/actions";

// Every page except sign-out and static files.
export const config = {
  matcher: ["/((?!logout$|_next/|favicon\\.ico$).*)"],
};
