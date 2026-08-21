"use client";

import type { ReactNode } from "react";
import { SmartMineDateFilter } from "./SmartMineDateFilter";
import { SmartMineNav } from "./SmartMineNav";
import { useSmartMineOverview } from "./useSmartMineOverview";
import type { SmartMineOverview } from "@/lib/smartmine/types";

export function SmartMineFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: (state: {
    data: SmartMineOverview | null;
    loading: boolean;
    error: string;
    from: string;
    to: string;
  }) => ReactNode;
}) {
  const { from, to, setRange, data, error, loading, reload } =
    useSmartMineOverview();

  return (
    <div>
      <div className="mb-3 border-b border-[var(--border)] pb-3">
        <h1 className="text-lg font-semibold tracking-tight text-[var(--fg)]">
          {title}
        </h1>
        <p className="mt-0.5 max-w-3xl text-sm text-[var(--muted)]">{description}</p>
      </div>
      <SmartMineNav from={from} to={to} />
      <SmartMineDateFilter
        from={from}
        to={to}
        onChange={setRange}
        onReload={() => void reload()}
        loading={loading}
        sync={data?.sync}
      />
      {error ? <p className="mb-3 text-sm text-rose-700">{error}</p> : null}
      {children({ data, loading, error, from, to })}
    </div>
  );
}
