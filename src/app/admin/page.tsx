import Link from "next/link";
import { requireAppAccess } from "@/platform/actions";
import { requireUser } from "@/platform/auth";
import { PageHeading } from "./page-heading";

// Who may see this page is decided per request, so navigation waits for the server.
export const instant = false;

const PAGES = [
  {
    name: "Apps",
    path: "/admin/apps",
    summary: "Every app on the platform and the groups allowed to open it.",
  },
  {
    name: "Roles",
    path: "/admin/roles",
    summary: "The actions of each app and the groups allowed to perform them.",
  },
  {
    name: "People",
    path: "/admin/people",
    summary: "Everyone who can sign in and the groups they belong to.",
  },
  {
    name: "Audit log",
    path: "/admin/audit",
    summary: "Every action tried in any app: who, what, when and how it ended.",
  },
];

export default async function AdminPage() {
  await requireUser();
  await requireAppAccess("admin");
  return (
    <div className="flex flex-col gap-4">
      <PageHeading
        title="Admin centre"
        summary="Who can open and do what on the platform, and what has been done. Read-only."
      />
      <ul aria-label="Admin pages" className="grid gap-3 sm:grid-cols-2">
        {PAGES.map((page) => (
          <li key={page.path} className="rounded-md border p-4">
            <Link
              href={page.path}
              className="font-medium underline-offset-4 hover:underline"
            >
              {page.name}
            </Link>
            <p className="text-sm text-muted-foreground">{page.summary}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
