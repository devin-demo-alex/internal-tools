export function PageHeading({ title, summary }: { title: string; summary: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{summary}</p>
    </div>
  );
}
