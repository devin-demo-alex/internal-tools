import type { ReactNode } from "react";

export type DetailField = { label: string; value: ReactNode };

export type DetailLayoutProps = {
  title: string;
  fields: DetailField[];
  actions?: ReactNode;
  children?: ReactNode;
};

export function DetailLayout({
  title,
  fields,
  actions,
  children,
}: DetailLayoutProps) {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      <dl className="grid grid-cols-1 gap-x-8 gap-y-4 rounded-lg border p-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.label} className="flex min-w-0 flex-col gap-1">
            <dt className="text-xs font-medium text-muted-foreground">
              {field.label}
            </dt>
            <dd className="text-sm break-words">{field.value}</dd>
          </div>
        ))}
      </dl>
      {children}
    </section>
  );
}
