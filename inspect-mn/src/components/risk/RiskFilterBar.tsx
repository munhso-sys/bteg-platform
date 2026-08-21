"use client";

import { RISK_FILTERS, RISK_SOURCE_FILTER, type RiskFilterId } from "@/lib/risk/filter";
import type { RiskSource } from "@/lib/risk/types";
import { cn } from "@/lib/cn";

export function RiskFilterBar({
  filter,
  source,
  query,
  onFilter,
  onSource,
  onQuery,
}: {
  filter: RiskFilterId;
  source: "all" | RiskSource;
  query: string;
  onFilter: (id: RiskFilterId) => void;
  onSource: (id: "all" | RiskSource) => void;
  onQuery: (q: string) => void;
}) {
  return (
    <div className="mb-3 flex flex-col gap-3 rounded-md border border-[var(--border)] bg-[var(--card)] p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-1.5">
        {RISK_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onFilter(f.id)}
            className={cn(
              "shrink-0 rounded px-3 py-2 text-xs font-medium transition",
              filter === f.id
                ? "bg-[var(--brand)] text-white"
                : "border border-[var(--border)] bg-[var(--card)] text-[var(--fg)] hover:bg-[var(--surface-muted)]",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <select
          className="input sm:w-48"
          value={source}
          onChange={(e) => onSource(e.target.value as "all" | RiskSource)}
        >
          {RISK_SOURCE_FILTER.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <input
          className="input sm:w-56"
          placeholder="Эрсдэл, нэгж, хариуцагч хайх"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
      </div>
    </div>
  );
}
