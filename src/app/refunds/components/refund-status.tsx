import { StatusBadge, type StatusTone } from "@/platform/ui";
import type { RefundStatus } from "@/platform/services/payments";

const tones: Record<RefundStatus, StatusTone> = {
  requested: "warning",
  approved: "success",
  rejected: "danger",
};

export function RefundStatusBadge({ status }: { status: RefundStatus }) {
  return <StatusBadge label={status} tone={tones[status]} />;
}
