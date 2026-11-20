import { cn } from "cn";
import { CircleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";

export type ErrorBannerProps = {
  message: ReactNode;
  title?: string;
  className?: string;
};

export function ErrorBanner({ message, title, className }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900",
        className,
      )}
    >
      <CircleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        {title ? <p className="font-medium">{title}</p> : null}
        <div>{message}</div>
      </div>
    </div>
  );
}
