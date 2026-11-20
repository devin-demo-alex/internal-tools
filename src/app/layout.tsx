import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { getCurrentUser } from "@/platform/auth";
import { appsFor } from "@/platform/registry";
import { AppShell } from "@/platform/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "Internal tools",
  description: "Prototype internal-tools platform on made-up data",
};

// Signed-out pages (only /login) render without the shell.
async function SignedInShell({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return children;
  return (
    <AppShell
      user={{ name: user.name, email: user.email }}
      apps={appsFor(user).map(({ name, path }) => ({ name, path }))}
    >
      {children}
    </AppShell>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {/* The session is read per request, so everything streams in behind this. */}
        <Suspense fallback={null}>
          <SignedInShell>{children}</SignedInShell>
        </Suspense>
      </body>
    </html>
  );
}
