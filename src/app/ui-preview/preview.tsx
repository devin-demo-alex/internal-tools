"use client";

import { useState, type ReactNode } from "react";

import {
  ActionButton,
  DataTable,
  DetailLayout,
  ErrorBanner,
  NumberField,
  SelectField,
  StatusBadge,
  TextField,
  TextareaField,
  type DataTableColumn,
  type StatusTone,
} from "@/platform/ui";

type Refund = {
  id: string;
  customer: string;
  amount: number;
  status: "Pending" | "Approved" | "Rejected";
};

const refunds: Refund[] = [
  { id: "RF-1003", customer: "Maple Books", amount: 120.5, status: "Pending" },
  { id: "RF-1001", customer: "Acorn Cafe", amount: 18, status: "Approved" },
  { id: "RF-1004", customer: "Zephyr Cycles", amount: 950, status: "Rejected" },
  { id: "RF-1002", customer: "Birch Dental", amount: 64.25, status: "Pending" },
];

const statusTones: Record<Refund["status"], StatusTone> = {
  Pending: "warning",
  Approved: "success",
  Rejected: "danger",
};

const refundColumns: DataTableColumn<Refund>[] = [
  { id: "id", header: "Refund" },
  { id: "customer", header: "Customer" },
  {
    id: "amount",
    header: "Amount",
    cell: (refund) => `$${refund.amount.toFixed(2)}`,
  },
  {
    id: "status",
    header: "Status",
    cell: (refund) => (
      <StatusBadge label={refund.status} tone={statusTones[refund.status]} />
    ),
  },
];

const noRefunds: Refund[] = [];

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function UiPreview({ userName }: { userName: string }) {
  const [lastAction, setLastAction] = useState("No action yet");

  return (
    <div className="flex max-w-4xl flex-col gap-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">UI preview</h1>
        <p className="text-sm text-muted-foreground">
          Every shared screen part, shown with made-up data.
        </p>
      </div>

      <Section title="AppShell">
        <p className="text-sm">
          The frame around this page is the AppShell: the top bar with your
          name ({userName}) and the sign-out link, and the menu of the apps
          you may open.
        </p>
      </Section>

      <Section title="DataTable">
        <DataTable
          columns={refundColumns}
          rows={refunds}
          getRowId={(refund) => refund.id}
          filter={{ label: "Filter refunds", placeholder: "Type to filter" }}
          emptyMessage="No refunds match."
        />
      </Section>

      <Section title="DataTable, empty">
        <DataTable
          columns={refundColumns}
          rows={noRefunds}
          emptyMessage="No refunds yet."
        />
      </Section>

      <Section title="DetailLayout and ActionButton">
        <DetailLayout
          title="Refund RF-1003"
          fields={[
            { label: "Customer", value: "Maple Books" },
            { label: "Amount", value: "$120.50" },
            {
              label: "Status",
              value: <StatusBadge label="Pending" tone="warning" />,
            },
            { label: "Requested by", value: "sam@example.test" },
          ]}
          actions={
            <>
              <ActionButton
                label="Approve refund"
                confirmDescription="This approves the refund of $120.50 to Maple Books."
                requireNote
                noteLabel="Reason"
                action={async ({ note }) => {
                  await wait(600);
                  setLastAction(`Approved refund RF-1003: ${note}`);
                }}
              />
              <ActionButton
                label="Archive"
                variant="outline"
                action={async () => {
                  await wait(600);
                  setLastAction("Archived refund RF-1003");
                }}
              />
              <ActionButton
                label="Reject refund"
                variant="destructive"
                action={async () => {
                  await wait(600);
                  return { error: "You are not allowed to reject refunds." };
                }}
              />
            </>
          }
        >
          <p className="text-sm">
            Last action: <span data-testid="last-action">{lastAction}</span>
          </p>
        </DetailLayout>
      </Section>

      <Section title="FormField">
        <form
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
          onSubmit={(event) => event.preventDefault()}
        >
          <TextField
            label="Customer name"
            name="customer"
            defaultValue=""
            description="As shown on the account."
            error="Customer name is required."
          />
          <NumberField
            label="Amount"
            name="amount"
            defaultValue={-5}
            error="Amount must be greater than zero."
          />
          <SelectField
            label="Reason"
            name="reason"
            placeholder="Choose a reason"
            options={[
              { value: "duplicate", label: "Duplicate charge" },
              { value: "damaged", label: "Damaged goods" },
              { value: "other", label: "Other" },
            ]}
            error="Choose a reason."
          />
          <TextareaField
            label="Notes"
            name="notes"
            defaultValue="Called."
            error="Notes must be at least 20 characters."
          />
        </form>
      </Section>

      <Section title="StatusBadge">
        <div className="flex flex-wrap gap-2">
          <StatusBadge label="Draft" />
          <StatusBadge label="In review" tone="info" />
          <StatusBadge label="Approved" tone="success" />
          <StatusBadge label="Pending" tone="warning" />
          <StatusBadge label="Rejected" tone="danger" />
        </div>
      </Section>

      <Section title="ErrorBanner">
        <ErrorBanner
          title="Could not load refunds"
          message="The payments service did not answer. Try again in a minute."
        />
      </Section>
    </div>
  );
}
