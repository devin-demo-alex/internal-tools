import Link from "next/link";

export default function NotFound() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">404: Not found</h1>
      <p>This page does not exist.</p>
      <Link href="/" className="underline">
        Back to home
      </Link>
    </div>
  );
}
