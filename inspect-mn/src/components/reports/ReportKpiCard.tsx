import { cn } from "@/lib/cn";
import type { KpiTone } from "@/lib/reports/types";

export function ReportKpiCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: KpiTone;
}) {
  const bar = {
    neutral: "border-l-slate-400",
    good: "border-l-emerald-500",
    warn: "border-l-amber-500",
    bad: "border-l-rose-500",
  } as const;
  return (
    <div
      className={cn(
        "rounded-md border border-[var(--border)] border-l-4 bg-[var(--card)] p-3",
        bar[tone],
      )}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--fg)]">
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-[var(--muted)]">{hint}</div> : null}
    </div>
  );
}
