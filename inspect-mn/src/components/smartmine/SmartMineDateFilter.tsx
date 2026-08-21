"use client";

import { RefreshCw } from "lucide-react";
import { SMARTMINE_DEFAULT_FROM, todayIso } from "@/lib/smartmine/constants";
import { SyncStatusChip } from "./SyncStatusChip";
import type { SyncStatus } from "@/lib/smartmine/types";

export function SmartMineDateFilter({
  from,
  to,
  onChange,
  onReload,
  loading,
  sync,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  onReload: () => void;
  loading: boolean;
  sync?: SyncStatus | null;
}) {
  return (
    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
          Эхлэх
          <input
            type="date"
            value={from}
            max={to}
            onChange={(event) => onChange(event.target.value, to)}
            className="input h-9 min-h-0 w-[9.75rem] py-1"
          />
        </label>
        <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
          Дуусах
          <input
            type="date"
            value={to}
            min={from}
            max={todayIso()}
            onChange={(event) => onChange(from, event.target.value)}
            className="input h-9 min-h-0 w-[9.75rem] py-1"
          />
        </label>
        <button
          type="button"
          className="btn btn-ghost h-9 min-h-0 px-2.5 text-xs"
          onClick={() => onChange(SMARTMINE_DEFAULT_FROM, todayIso())}
        >
          2026-01-01 → өнөөдөр
        </button>
      </div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <SyncStatusChip sync={sync ?? null} />
        <button
          type="button"
          className="btn btn-ghost h-9 min-h-0 px-2.5"
          onClick={onReload}
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Шинэчлэх
        </button>
      </div>
    </div>
  );
}
