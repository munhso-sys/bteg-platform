"use client";

import { Search } from "lucide-react";
import { useState } from "react";

export function FilterBar({
  filters,
  searchPlaceholder = "Хайх...",
}: {
  filters: string[];
  searchPlaceholder?: string;
}) {
  const [active, setActive] = useState(filters[0] ?? "Бүгд");
  const [query, setQuery] = useState("");

  return (
    <div className="flex flex-col gap-3 rounded-md border border-[var(--border)] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-1.5 pb-0.5">
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setActive(f)}
            className={`shrink-0 rounded px-3 py-2 text-xs font-medium transition ${
              active === f
                ? "bg-[var(--brand)] text-white"
                : "border border-[var(--border)] bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
      <label className="relative block w-full sm:w-64">
        <Search
          size={14}
          className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-[var(--muted)]"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          className="input pl-8"
        />
      </label>
    </div>
  );
}
