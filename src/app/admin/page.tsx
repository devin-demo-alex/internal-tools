import { requireAppAccess } from "@/platform/actions";
import { requireUser } from "@/platform/auth";

// Who may see this page is decided per request, so navigation waits for the server.
export const instant = false;

export default async function AdminPage() {
  await requireUser();
  await requireAppAccess("admin");
  return (
    <div>
      <h1 className="text-2xl font-semibold">Admin</h1>
      <p>Not built yet</p>
    </div>
  );
}
