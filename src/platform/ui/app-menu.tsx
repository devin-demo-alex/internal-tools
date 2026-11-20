"use client";

import { cn } from "cn";
import Link from "next/link";
import { usePathname } from "next/navigation";

type AppMenuProps = { apps: { name: string; path: string }[] };

export function AppMenuList({
  apps,
  currentPath,
}: AppMenuProps & { currentPath?: string }) {
  if (apps.length === 0) {
    return <p className="px-2 text-sm text-muted-foreground">No apps</p>;
  }
  return (
    <ul className="flex flex-col gap-1">
      {apps.map((app) => {
        const active =
          currentPath === app.path ||
          (currentPath?.startsWith(`${app.path}/`) ?? false);
        return (
          <li key={app.path}>
            <Link
              href={app.path}
              aria-current={active ? "page" : undefined}
              className={cn(
                "block rounded-md px-2 py-1.5 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active &&
                  "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
              )}
            >
              {app.name}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function AppMenu({ apps }: AppMenuProps) {
  return <AppMenuList apps={apps} currentPath={usePathname()} />;
}
