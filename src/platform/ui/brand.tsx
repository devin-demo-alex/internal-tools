import { cn } from "cn";

/** The company identity shown in the page frame. A made-up placeholder: change it here only. */
export const BRAND = {
  company: "Larkspur Financial",
  product: "Internal tools",
  notice: "For internal use only. Activity is logged.",
} as const;

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-7 shrink-0", className)}
    >
      <rect width="32" height="32" rx="7" fill="#1e3a8a" />
      <path
        d="M10 8v16h12"
        fill="none"
        stroke="#fff"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="21" cy="12" r="2.75" fill="#5eead4" />
    </svg>
  );
}

/** Logo, company name and product name, side by side. */
export function BrandLockup({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <BrandMark />
      <span className="text-sm font-semibold tracking-tight whitespace-nowrap">
        {BRAND.company}
      </span>
      <span aria-hidden="true" className="hidden h-4 w-px bg-border sm:block" />
      <span className="hidden text-sm whitespace-nowrap text-muted-foreground sm:inline">
        {BRAND.product}
      </span>
    </span>
  );
}

export function BrandFooter({ className }: { className?: string }) {
  return (
    <footer
      className={cn(
        "flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t px-4 py-3 text-xs text-muted-foreground",
        className,
      )}
    >
      <span>
        {BRAND.company} · {BRAND.product}
      </span>
      <span>{BRAND.notice}</span>
    </footer>
  );
}
