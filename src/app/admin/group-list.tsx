import { StatusBadge } from "@/platform/ui";

export function GroupList({ groups }: { groups: string[] }) {
  if (groups.length === 0) {
    return <span className="text-muted-foreground">None</span>;
  }
  return (
    <span className="flex flex-wrap gap-1">
      {groups.map((group) => (
        <StatusBadge key={group} label={group} />
      ))}
    </span>
  );
}
