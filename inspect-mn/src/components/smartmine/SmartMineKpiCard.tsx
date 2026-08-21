import { cn } from "@/lib/cn";
import type { KpiTone } from "@/lib/reports/types";

const BAR: Record<KpiTone, string> = {
  neutral: "border-l-slate-400",
  good: "border-l-emerald-500",
  warn: "border-l-amber-500",
  bad: "border-l-rose-500",
};

export function SmartMineKpiCard({
  label,
  value,
  unit,
  hint,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  hint?: string;
  tone: KpiTone;
}) {
  return (
    <div
      className={cn(
        "min-h-[4.75rem] rounded-md border border-[var(--border)] border-l-4 bg-[var(--card)] px-2.5 py-2",
        BAR[tone],
      )}
    >
      <div className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-1 flex min-w-0 items-baseline gap-1">
        <div className="truncate text-lg font-semibold leading-none tabular-nums text-[var(--fg)] sm:text-xl">
          {value}
        </div>
        {unit ? (
          <div className="shrink-0 text-[11px] font-medium text-[var(--muted)]">
            {unit}
          </div>
        ) : null}
      </div>
      {hint ? (
        <div className="mt-1 truncate text-[10px] leading-tight text-[var(--muted)]">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
