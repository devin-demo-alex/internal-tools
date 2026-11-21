import Link from "next/link";
import { Suspense, type ReactNode } from "react";

import { AppMenu, AppMenuList } from "./app-menu";
import { BrandFooter, BrandLockup } from "./brand";

export type AppShellProps = {
  user: { name: string; email: string };
  apps: { name: string; path: string }[];
  children: ReactNode;
};

export function AppShell({ user, apps, children }: AppShellProps) {
  return (
    <div className="flex min-h-screen flex-1 flex-col bg-background text-foreground">
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-card px-4 shadow-xs">
        <Link href="/" className="rounded-md">
          <BrandLockup />
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-2" title={user.email}>
            <span
              aria-hidden="true"
              className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-medium"
            >
              {user.name
                .split(/\s+/)
                .map((part) => part[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </span>
            <span className="font-medium">{user.name}</span>
          </span>
          {/* A plain link: signing out loads a new document, so nothing of this frame stays on screen. */}
          <a
            href="/logout"
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Sign out
          </a>
        </div>
      </header>
      <div className="flex flex-1 flex-col md:flex-row">
        <nav
          aria-label="Apps"
          className="shrink-0 border-b bg-sidebar p-3 text-sidebar-foreground md:w-56 md:border-r md:border-b-0"
        >
          <p className="px-2 pb-2 text-xs font-medium text-muted-foreground">
            Apps
          </p>
          <Suspense fallback={<AppMenuList apps={apps} />}>
            <AppMenu apps={apps} />
          </Suspense>
        </nav>
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
      <BrandFooter />
    </div>
  );
}
