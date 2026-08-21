"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { AnnualPlanMetric } from "@/lib/types";

export type RunPlanMetricFilterValue = Exclude<
  AnnualPlanMetric,
  "regular" | "as_needed"
>;

export type RunPlanMetricFilterOption = {
  value: RunPlanMetricFilterValue;
  label: string;
};

export function RunPlanMetricFilter({
  options,
  selectedMetric,
}: {
  options: RunPlanMetricFilterOption[];
  selectedMetric: RunPlanMetricFilterValue | "all";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <label className="block max-w-sm text-sm">
      <span className="mb-1 block font-medium">Ангилал</span>
      <select
        className="select w-full"
        value={selectedMetric}
        onChange={(event) => {
          const nextParams = new URLSearchParams(searchParams);
          const nextMetric = event.target.value;

          if (nextMetric === "all") {
            nextParams.delete("metric");
          } else {
            nextParams.set("metric", nextMetric);
          }

          const query = nextParams.toString();
          router.push(query ? `${pathname}?${query}` : pathname);
        }}
      >
        <option value="all">Бүх ангилал</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
