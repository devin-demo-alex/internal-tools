"use client";

import { useId, useState, type ComponentProps, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { ErrorBanner } from "./error-banner";
import { TextareaField } from "./form-field";

export type ActionInput = { note?: string };
export type ActionOutcome = void | { error?: string };

export type ActionButtonProps = {
  label: string;
  action: (input: ActionInput) => Promise<ActionOutcome>;
  confirmTitle?: string;
  confirmDescription?: string;
  confirmLabel?: string;
  pendingLabel?: string;
  requireNote?: boolean;
  noteLabel?: string;
  variant?: ComponentProps<typeof Button>["variant"];
  disabled?: boolean;
};

export function ActionButton({
  label,
  action,
  confirmTitle,
  confirmDescription = "Please confirm that you want to do this.",
  confirmLabel = "Confirm",
  pendingLabel = "Working…",
  requireNote = false,
  noteLabel = "Note",
  variant = "default",
  disabled = false,
}: ActionButtonProps) {
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string>();
  const [error, setError] = useState<string>();

  function changeOpen(next: boolean) {
    if (pending) return;
    setOpen(next);
    if (next) {
      setNote("");
      setNoteError(undefined);
      setError(undefined);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const trimmed = note.trim();
    if (requireNote && trimmed === "") {
      setNoteError(`${noteLabel} is required.`);
      return;
    }
    setNoteError(undefined);
    setError(undefined);
    setPending(true);
    try {
      const outcome = await action(requireNote ? { note: trimmed } : {});
      if (outcome && outcome.error) {
        setError(outcome.error);
      } else {
        setOpen(false);
      }
    } catch (cause) {
      setError(
        cause instanceof Error && cause.message
          ? cause.message
          : "The action failed.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant={variant}
        disabled={disabled || pending}
        aria-busy={pending || undefined}
        onClick={() => changeOpen(true)}
      >
        {pending ? pendingLabel : label}
      </Button>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>{confirmTitle ?? label}</DialogTitle>
            <DialogDescription>{confirmDescription}</DialogDescription>
          </DialogHeader>
          <form id={formId} onSubmit={submit} className="flex flex-col gap-4">
            {requireNote ? (
              <TextareaField
                label={noteLabel}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                error={noteError}
                disabled={pending}
                aria-required
              />
            ) : null}
            {error ? <ErrorBanner message={error} /> : null}
          </form>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => changeOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form={formId}
              variant={variant}
              disabled={pending}
              aria-busy={pending || undefined}
            >
              {pending ? pendingLabel : confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
