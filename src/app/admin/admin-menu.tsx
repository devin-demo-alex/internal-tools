import Link from "next/link";

const PAGES = [
  { name: "Apps", path: "/admin/apps" },
  { name: "Roles", path: "/admin/roles" },
  { name: "People", path: "/admin/people" },
  { name: "Audit log", path: "/admin/audit" },
];

export function AdminMenu() {
  return (
    <nav aria-label="Admin centre" className="border-b pb-3">
      <ul className="flex flex-wrap gap-4 text-sm">
        {PAGES.map((page) => (
          <li key={page.path}>
            <Link
              href={page.path}
              className="font-medium underline-offset-4 hover:underline"
            >
              {page.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
