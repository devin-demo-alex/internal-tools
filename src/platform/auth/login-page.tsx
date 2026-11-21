import { BrandFooter, BrandLockup } from "@/platform/ui";
import { LoginForm } from "./login-form";

/** The /login page. src/app/login/page.tsx only re-exports it. */
export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col bg-muted/40">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-6">
        <BrandLockup className="mb-6 justify-center" />
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="mb-4 text-neutral-600">Choose a test user.</p>
          <LoginForm />
        </div>
      </main>
      <BrandFooter className="justify-center border-t-0" />
    </div>
  );
}
