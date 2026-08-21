import Link from "next/link";
import { cn } from "@/lib/cn";
import type { ReasonCandidate } from "@/lib/smartmine/types";
import { withRange } from "./useSmartMineOverview";

const TONE = {
  critical: "border-l-rose-600",
  high: "border-l-rose-500",
  medium: "border-l-amber-500",
  info: "border-l-slate-400",
} as const;

export function ReasonToolBlock({
  reasons,
  from,
  to,
  compact = false,
}: {
  reasons: ReasonCandidate[];
  from: string;
  to: string;
  compact?: boolean;
}) {
  const rows = compact ? reasons.slice(0, 4) : reasons;
  return (
    <section className={cn(
      "rounded-md border border-[var(--border)] bg-[var(--card)]",
      compact && "flex h-full min-h-0 flex-col overflow-hidden",
    )}>
      <div className="flex items-start justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Reason Tool</h2>
          <p className="text-[11px] text-[var(--muted)]">
            Root-cause candidate · MTTR / downtime
          </p>
        </div>
        {compact ? (
          <Link
            href={withRange("/smartmine/reason-tool", from, to)}
            className="text-xs font-medium text-[var(--brand)] hover:underline"
          >
            Бүгдийг харах →
          </Link>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <p className="px-3 py-6 text-sm text-[var(--muted)]">
          Энэ интервалд candidate event алга.
        </p>
      ) : (
        <ul className={compact ? "min-h-0 flex-1 divide-y divide-[var(--border)] overflow-y-auto" : "divide-y divide-[var(--border)]"}>
          {rows.map((row) => (
            <li
              key={row.id}
              className={cn("border-l-4 px-3 py-2", TONE[row.severity])}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 text-sm font-medium">{row.title}</div>
                <div className="shrink-0 text-[11px] tabular-nums text-[var(--muted)]">
                  {row.date ?? "—"}
                  {row.metric ? ` · ${row.metric}` : ""}
                </div>
              </div>
              {row.detail ? (
                <p
                  className={
                    compact
                      ? "mt-1 line-clamp-2 text-xs text-[var(--muted)]"
                      : "mt-1 text-sm text-[var(--muted)]"
                  }
                >
                  {row.detail}
                </p>
              ) : null}
              {compact ? null : (
                <p className="mt-1 font-mono text-[10px] text-[var(--muted)]">
                  {row.source}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
