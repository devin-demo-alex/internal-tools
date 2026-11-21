import { StatusBadge, type StatusTone } from "@/platform/ui";
import type { CaseStatus } from "@/platform/services/identity";

const tones: Record<CaseStatus, StatusTone> = {
  open: "warning",
  approved: "success",
  rejected: "danger",
  escalated: "info",
};

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  return <StatusBadge label={status} tone={tones[status]} />;
}
