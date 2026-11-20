import Link from "next/link";
import type { ReactNode } from "react";

export type AppShellProps = {
  user: { name: string; email: string };
  apps: { name: string; path: string }[];
  children: ReactNode;
};

export function AppShell({ user, apps, children }: AppShellProps) {
  return (
    <div>
      <header>
        <span>{user.name}</span>
        <nav>
          <ul>
            {apps.map((app) => (
              <li key={app.path}>
                <Link href={app.path}>{app.name}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main>{children}</main>
    </div>
  );
}
