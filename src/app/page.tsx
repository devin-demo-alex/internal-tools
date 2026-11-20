import Link from "next/link";
import { requireUser } from "@/platform/auth";
import { appsFor } from "@/platform/registry";

// Who may see this page is decided per request, so navigation waits for the server.
export const instant = false;

export default async function Home() {
  const user = await requireUser();
  const apps = appsFor(user);
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Internal tools</h1>
      {apps.length === 0 ? (
        <p>You have no apps.</p>
      ) : (
        <ul aria-label="Your apps" className="mt-4 flex flex-col gap-3">
          {apps.map((app) => (
            <li key={app.id}>
              <Link href={app.path} className="font-medium underline">
                {app.name}
              </Link>
              <p className="text-neutral-600">{app.description}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
