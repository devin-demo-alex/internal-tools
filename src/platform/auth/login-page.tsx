import { LoginForm } from "./login-form";

/** The /login page. src/app/login/page.tsx only re-exports it. */
export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-md p-8">
      <h1 className="text-2xl font-semibold">Sign in</h1>
      <p className="mb-4 text-neutral-600">Choose a test user.</p>
      <LoginForm />
    </main>
  );
}
