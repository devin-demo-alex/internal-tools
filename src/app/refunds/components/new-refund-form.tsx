"use client";

import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  ErrorBanner,
  NumberField,
  SelectField,
  TextareaField,
  type SelectOption,
} from "@/platform/ui";

export type NewRefundInput = {
  paymentId: string;
  amountCents: number;
  reason: string;
};

type NewRefundFormProps = {
  payments: SelectOption[];
  action: (input: NewRefundInput) => Promise<{ error?: string }>;
};

export function NewRefundForm({ payments, action }: NewRefundFormProps) {
  const [open, setOpen] = useState(false);
  const [paymentId, setPaymentId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (paymentId === "") {
      setError("Pick a payment.");
      return;
    }
    setError(undefined);
    setPending(true);
    try {
      const outcome = await action({
        paymentId,
        amountCents: Math.round(Number(amount) * 100),
        reason: reason.trim(),
      });
      if (outcome.error) {
        setError(outcome.error);
      } else {
        setOpen(false);
        setPaymentId("");
        setAmount("");
        setReason("");
      }
    } catch {
      setError("The request failed.");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)}>
        New refund request
      </Button>
    );
  }

  return (
    <form
      onSubmit={submit}
      aria-label="New refund request"
      className="flex max-w-xl flex-col gap-4 rounded-lg border p-4"
    >
      <h2 className="text-lg font-semibold">New refund request</h2>
      <SelectField
        label="Payment"
        placeholder="Pick a payment"
        options={payments}
        value={paymentId}
        onValueChange={setPaymentId}
        disabled={pending}
      />
      <NumberField
        label="Refund amount"
        description="In the currency of the payment."
        min="0.01"
        step="0.01"
        required
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        disabled={pending}
      />
      <TextareaField
        label="Reason"
        required
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        disabled={pending}
      />
      {error ? <ErrorBanner message={error} /> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send request"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => setOpen(false)}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
