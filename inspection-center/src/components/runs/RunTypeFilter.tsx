"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { InspectionType } from "@/lib/types";

export type RunTypeFilterOption = {
  value: InspectionType;
  label: string;
};

export function RunTypeFilter({
  options,
  selectedType,
}: {
  options: RunTypeFilterOption[];
  selectedType: InspectionType | "all";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <label className="block max-w-sm text-sm">
      <span className="mb-1 block font-medium">ХШ-ийн төрөл</span>
      <select
        className="select w-full"
        value={selectedType}
        onChange={(event) => {
          const nextParams = new URLSearchParams(searchParams);
          const nextType = event.target.value;

          if (nextType === "all") {
            nextParams.delete("type");
          } else {
            nextParams.set("type", nextType);
          }

          const query = nextParams.toString();
          router.push(query ? `${pathname}?${query}` : pathname);
        }}
      >
        <option value="all">Бүх ХШ</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
