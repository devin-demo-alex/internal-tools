import { requireAppAccess } from "@/platform/actions";
import { requireUser } from "@/platform/auth";
import { apps, getPermissions } from "@/platform/registry";
import { PageHeading } from "../page-heading";
import { buildRolesGrid } from "./grid";
import { RolesGridTable } from "./roles-grid";

// Who may see this page is decided per request, so navigation waits for the server.
export const instant = false;

export default async function AdminRolesPage() {
  await requireUser();
  await requireAppAccess("admin");
  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="Roles"
        summary="For each app, which groups may do which actions. Read from each app's permissions.ts. Read-only."
      />
      {apps.map((app) => (
        <section
          key={app.id}
          aria-labelledby={`roles-${app.id}`}
          className="flex flex-col gap-2"
        >
          <h2 id={`roles-${app.id}`} className="text-lg font-semibold">
            {app.name}
          </h2>
          <RolesGridTable
            grid={buildRolesGrid(getPermissions(app.id), app.openGroups)}
          />
        </section>
      ))}
    </div>
  );
}
