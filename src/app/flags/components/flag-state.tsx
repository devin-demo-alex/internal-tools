import { StatusBadge } from "@/platform/ui";

export function FlagStateBadge({ enabled }: { enabled: boolean }) {
  return <StatusBadge label={enabled ? "on" : "off"} tone={enabled ? "success" : "neutral"} />;
}
