"use client";

import { useRouter } from "next/navigation";

import { SelectField } from "@/platform/ui";

const options = [
  { value: "all", label: "All" },
  { value: "production", label: "Production" },
  { value: "staging", label: "Staging" },
];

/** Puts the chosen environment in the URL; the page reads it and filters the list. */
export function EnvironmentFilter({ environment }: { environment: string | undefined }) {
  const router = useRouter();
  return (
    <div className="w-48">
      <SelectField
        label="Environment"
        options={options}
        value={environment ?? "all"}
        onValueChange={(value) =>
          router.push(value === "all" ? "/flags" : `/flags?environment=${value}`)
        }
      />
    </div>
  );
}
