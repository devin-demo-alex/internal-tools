"use client";

import { useRouter } from "next/navigation";

import { SelectField } from "@/platform/ui";

const options = [
  { value: "all", label: "All" },
  { value: "requested", label: "Requested" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

/** Puts the chosen status in the URL; the page reads it and asks the service. */
export function StatusFilter({ status }: { status: string | undefined }) {
  const router = useRouter();
  return (
    <div className="w-48">
      <SelectField
        label="Status"
        options={options}
        value={status ?? "all"}
        onValueChange={(value) =>
          router.push(value === "all" ? "/refunds" : `/refunds?status=${value}`)
        }
      />
    </div>
  );
}
