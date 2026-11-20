import { requireAppAccess } from "@/platform/actions";
import { requireUser } from "@/platform/auth";
import { listPeople } from "@/platform/directory";
import { PageHeading } from "../page-heading";
import { PeopleTable } from "./people-table";

// Who may see this page is decided per request, so navigation waits for the server.
export const instant = false;

export default async function AdminPeoplePage() {
  await requireUser();
  await requireAppAccess("admin");
  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="People"
        summary="The test users and the groups they are in. Read-only."
      />
      <p className="rounded-md border bg-muted px-3 py-2 text-sm">
        This list stands in for Microsoft Entra. People and groups will come
        from there once it is connected.
      </p>
      <PeopleTable people={listPeople()} />
    </div>
  );
}
