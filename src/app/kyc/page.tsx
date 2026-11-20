import { forbidden } from "next/navigation";

import { requireAppAccess } from "@/platform/actions";
import { can } from "@/platform/policy";
import type { CaseStatus } from "@/platform/services/identity";

import { viewCases } from "./actions";
import { CasesTable } from "./components/cases-table";
import { StatusFilter } from "./components/status-filter";
import { permissions } from "./permissions";

// Who may see this page is decided per request, so navigation waits for the server.
export const instant = false;

const STATUSES: CaseStatus[] = ["open", "approved", "rejected", "escalated"];

export default async function KycPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const user = await requireAppAccess("kyc");
  if (!can(user, permissions, "kyc.view")) forbidden();

  const { status: wanted } = await searchParams;
  const status = STATUSES.find((candidate) => candidate === wanted);
  // The rows carry only the list columns: no ID number, no date of birth.
  const rows = await viewCases(user, { status });

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">KYC review queue</h1>
      <StatusFilter status={status} />
      <CasesTable rows={rows} />
    </div>
  );
}
