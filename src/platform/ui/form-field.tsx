"use client";

import { useId, type ComponentProps, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type FieldBaseProps = {
  label: string;
  error?: string;
  description?: string;
};

type FieldControlProps = {
  id: string;
  "aria-invalid": true | undefined;
  "aria-describedby": string | undefined;
};

function Field({
  id,
  label,
  error,
  description,
  children,
}: FieldBaseProps & {
  id: string;
  children: (control: FieldControlProps) => ReactNode;
}) {
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;
  const describedBy =
    [description ? descriptionId : null, error ? errorId : null]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })}
      {description ? (
        <p id={descriptionId} className="text-xs text-muted-foreground">
          {description}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function useFieldId(id: string | undefined) {
  const generated = useId();
  return id ?? generated;
}

export type TextFieldProps = FieldBaseProps &
  Omit<ComponentProps<"input">, "type">;

export function TextField({
  label,
  error,
  description,
  id,
  ...props
}: TextFieldProps) {
  const fieldId = useFieldId(id);
  return (
    <Field id={fieldId} label={label} error={error} description={description}>
      {(control) => <Input type="text" {...props} {...control} />}
    </Field>
  );
}

export type NumberFieldProps = FieldBaseProps &
  Omit<ComponentProps<"input">, "type">;

export function NumberField({
  label,
  error,
  description,
  id,
  ...props
}: NumberFieldProps) {
  const fieldId = useFieldId(id);
  return (
    <Field id={fieldId} label={label} error={error} description={description}>
      {(control) => <Input type="number" {...props} {...control} />}
    </Field>
  );
}

export type TextareaFieldProps = FieldBaseProps & ComponentProps<"textarea">;

export function TextareaField({
  label,
  error,
  description,
  id,
  ...props
}: TextareaFieldProps) {
  const fieldId = useFieldId(id);
  return (
    <Field id={fieldId} label={label} error={error} description={description}>
      {(control) => <Textarea {...props} {...control} />}
    </Field>
  );
}

export type SelectOption = { value: string; label: string };

export type SelectFieldProps = FieldBaseProps & {
  options: SelectOption[];
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
};

export function SelectField({
  label,
  error,
  description,
  id,
  options,
  placeholder,
  ...props
}: SelectFieldProps) {
  const fieldId = useFieldId(id);
  return (
    <Field id={fieldId} label={label} error={error} description={description}>
      {(control) => (
        <Select {...props}>
          <SelectTrigger className="w-full" {...control}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  );
}
