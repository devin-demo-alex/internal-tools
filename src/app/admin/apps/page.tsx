import { requireAppAccess } from "@/platform/actions";
import { requireUser } from "@/platform/auth";
import { apps } from "@/platform/registry";
import { PageHeading } from "../page-heading";
import { AppsTable } from "./apps-table";

// Who may see this page is decided per request, so navigation waits for the server.
export const instant = false;

export default async function AdminAppsPage() {
  await requireUser();
  await requireAppAccess("admin");
  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Apps"
        summary="Every app on the platform and the groups allowed to open it. Read-only."
      />
      <AppsTable apps={apps} />
    </div>
  );
}
