import { refresh } from "next/cache";
import Link from "next/link";
import { forbidden, notFound } from "next/navigation";

import {
  forbiddenPageOnDenied,
  requireAppAccess,
} from "@/platform/actions";
import { requireUser } from "@/platform/auth";
import type { User } from "@/platform/contracts";
import { can } from "@/platform/policy";
import { ServiceError } from "@/platform/services/identity";
import { ActionButton, DetailLayout, type ActionInput } from "@/platform/ui";

import {
  approveKycCase,
  claimKycCase,
  escalateKycCase,
  rejectKycCase,
  viewCase,
} from "../actions";
import { CaseStatusBadge } from "../components/case-status";
import { formatDate, formatDocumentType } from "../components/format";
import { permissions, type CaseResource } from "../permissions";

// Who may see this page is decided per request, so navigation waits for the server.
export const instant = false;

async function loadCase(user: User, id: string) {
  try {
    return await viewCase(user, id);
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) notFound();
    throw error;
  }
}

export default async function KycCasePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAppAccess("kyc");
  if (!can(user, permissions, "kyc.view")) forbidden();

  const { id } = await params;
  // Already masked on the server for this user.
  const kycCase = await loadCase(user, id);

  async function claimAction() {
    "use server";
    const user = await requireUser();
    const outcome = await forbiddenPageOnDenied(() => claimKycCase(user, id));
    if (!outcome.error) refresh();
    return outcome;
  }

  async function approveAction() {
    "use server";
    const user = await requireUser();
    const outcome = await forbiddenPageOnDenied(() => approveKycCase(user, id));
    if (!outcome.error) refresh();
    return outcome;
  }

  async function rejectAction({ note }: ActionInput) {
    "use server";
    const user = await requireUser();
    const outcome = await forbiddenPageOnDenied(() =>
      rejectKycCase(user, id, note ?? ""),
    );
    if (!outcome.error) refresh();
    return outcome;
  }

  async function escalateAction({ note }: ActionInput) {
    "use server";
    const user = await requireUser();
    const outcome = await forbiddenPageOnDenied(() =>
      escalateKycCase(user, id, note ?? ""),
    );
    if (!outcome.error) refresh();
    return outcome;
  }

  // The same fields runAction gets, so the buttons match the server check.
  const resource: CaseResource = {
    id: kycCase.id,
    status: kycCase.status,
    assignedTo: kycCase.assignedTo,
    riskScore: kycCase.riskScore,
  };
  const open = kycCase.status === "open";

  return (
    <DetailLayout
      title={`Case ${kycCase.id}`}
      fields={[
        { label: "Customer", value: kycCase.customerName },
        { label: "Date of birth", value: kycCase.dateOfBirth },
        { label: "Document type", value: formatDocumentType(kycCase.documentType) },
        {
          label: kycCase.idNumberMasked ? "ID number (masked)" : "ID number",
          value: kycCase.idNumber,
        },
        { label: "Risk score", value: kycCase.riskScore },
        { label: "Status", value: <CaseStatusBadge status={kycCase.status} /> },
        { label: "Assigned to", value: kycCase.assignedTo ?? "Unassigned" },
        {
          label: "Notes",
          value:
            kycCase.notes.length > 0 ? (
              <ul className="list-disc pl-4">
                {kycCase.notes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            ) : (
              "None"
            ),
        },
        { label: "Decided by", value: kycCase.decidedBy ?? "Not decided yet" },
        {
          label: "Decided at",
          value: kycCase.decidedAt ? formatDate(kycCase.decidedAt) : "Not decided yet",
        },
      ]}
      actions={
        <>
          {open && can(user, permissions, "kyc.claim", resource) ? (
            <ActionButton
              label="Claim"
              confirmTitle="Claim case"
              confirmDescription={`This assigns case ${kycCase.id} to you.`}
              action={claimAction}
            />
          ) : null}
          {open && can(user, permissions, "kyc.approve", resource) ? (
            <ActionButton
              label="Approve"
              confirmTitle="Approve case"
              confirmDescription={`This approves the identity check for ${kycCase.customerName}.`}
              action={approveAction}
            />
          ) : null}
          {open && can(user, permissions, "kyc.reject", resource) ? (
            <ActionButton
              label="Reject"
              variant="destructive"
              confirmTitle="Reject case"
              confirmDescription={`This rejects the identity check for ${kycCase.customerName}.`}
              requireNote
              action={rejectAction}
            />
          ) : null}
          {open && can(user, permissions, "kyc.escalate", resource) ? (
            <ActionButton
              label="Escalate"
              variant="outline"
              confirmTitle="Escalate case"
              confirmDescription={`This escalates case ${kycCase.id} to a lead.`}
              requireNote
              action={escalateAction}
            />
          ) : null}
        </>
      }
    >
      <Link href="/kyc" className="text-sm underline">
        Back to the queue
      </Link>
    </DetailLayout>
  );
}
