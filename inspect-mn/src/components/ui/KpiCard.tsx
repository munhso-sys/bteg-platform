import { cn } from "@/lib/cn";
import type { Kpi } from "@/lib/placeholder-data";

const BAR: Record<Kpi["tone"], string> = {
  neutral: "border-l-slate-400",
  good: "border-l-emerald-500",
  warn: "border-l-amber-500",
  bad: "border-l-rose-500",
};

export function KpiCard({ kpi }: { kpi: Kpi }) {
  return (
    <div
      className={cn(
        "rounded-md border border-[var(--border)] border-l-4 bg-white p-3",
        BAR[kpi.tone],
      )}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
        {kpi.label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--fg)]">
        {kpi.value}
      </div>
      <div className="mt-1 text-xs text-[var(--muted)]">{kpi.delta}</div>
    </div>
  );
}
