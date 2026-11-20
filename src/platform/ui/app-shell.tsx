import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { AppMenu, AppMenuList } from "./app-menu";

export type AppShellProps = {
  user: { name: string; email: string };
  apps: { name: string; path: string }[];
  children: ReactNode;
};

export function AppShell({ user, apps, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-4">
        <Link href="/" className="text-sm font-semibold tracking-tight">
          Internal tools
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium" title={user.email}>
            {user.name}
          </span>
          <Link
            href="/logout"
            prefetch={false}
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Sign out
          </Link>
        </div>
      </header>
      <div className="flex flex-1">
        <nav
          aria-label="Apps"
          className="w-56 shrink-0 border-r bg-sidebar p-3 text-sidebar-foreground"
        >
          <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">
            Apps
          </p>
          <Suspense fallback={<AppMenuList apps={apps} />}>
            <AppMenu apps={apps} />
          </Suspense>
        </nav>
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
