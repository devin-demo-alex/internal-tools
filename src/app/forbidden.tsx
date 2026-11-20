import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">403: Not allowed</h1>
      <p>You do not have permission to see this page or do this action.</p>
      <Link href="/" className="underline">
        Back to home
      </Link>
    </main>
  );
}
