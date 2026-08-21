"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { InspectionRunSaveStatus } from "@/lib/types";

export type RunStatusFilterOption = {
  value: InspectionRunSaveStatus;
  label: string;
};

export function RunStatusFilter({
  options,
  selectedStatus,
}: {
  options: RunStatusFilterOption[];
  selectedStatus: InspectionRunSaveStatus | "all";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <label className="block max-w-sm text-sm">
      <span className="mb-1 block font-medium">Төлөв</span>
      <select
        className="select w-full"
        value={selectedStatus}
        onChange={(event) => {
          const nextParams = new URLSearchParams(searchParams);
          const nextStatus = event.target.value;

          if (nextStatus === "all") {
            nextParams.delete("status");
          } else {
            nextParams.set("status", nextStatus);
          }

          const query = nextParams.toString();
          router.push(query ? `${pathname}?${query}` : pathname);
        }}
      >
        <option value="all">Бүх төлөв</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
