import { requireAppAccess } from "@/platform/actions";
import { requireUser } from "@/platform/auth";

// Who may see this page is decided per request, so navigation waits for the server.
export const instant = false;

export default async function FlagsPage() {
  await requireUser();
  await requireAppAccess("flags");
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Feature flags</h1>
      <p>Not built yet</p>
    </main>
  );
}
