import type { ReactNode } from "react";

export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "danger" | "brand";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
    ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warn: "bg-amber-50 text-amber-800 border-amber-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
    brand: "bg-orange-50 text-orange-800 border-orange-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
  className = "",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "ok" | "warn" | "danger" | "brand";
  className?: string;
}) {
  const bar: Record<string, string> = {
    default: "border-l-slate-400",
    ok: "border-l-emerald-500",
    warn: "border-l-amber-500",
    danger: "border-l-rose-500",
    brand: "border-l-[var(--brand)]",
  };
  return (
    <div
      className={`flex w-full flex-col items-start justify-center rounded-md border border-[var(--border)] border-l-4 bg-[var(--card)] px-3 py-2.5 text-left ${bar[tone]} ${className}`.trim()}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold leading-none tabular-nums text-[var(--fg)]">
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-xs leading-snug text-[var(--muted)]">{hint}</div>
      ) : null}
    </div>
  );
}

export function Panel({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
        <h2 className="min-w-0 text-sm font-semibold leading-snug text-[var(--fg)]">
          {title}
        </h2>
        {actions}
      </div>
      <div className="h-scroll min-w-0 max-w-full p-3">{children}</div>
    </section>
  );
}

/**
 * Scrollable table wrapper for phone/tablet/desktop.
 * Fits container width; adds horizontal + vertical scrollbars when needed.
 * Long text wraps to multiple lines via .cell-ellipsis / column classes.
 */
export function TableScroll({
  children,
  className = "",
  maxHeightClass = "max-h-[28rem]",
  size = "md",
}: {
  children: ReactNode;
  className?: string;
  /** Tailwind max-height utility; default ~28rem */
  maxHeightClass?: string;
  /** Controls table min-width before horizontal scroll appears */
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "sm"
      ? "table-scroll--sm"
      : size === "lg"
        ? "table-scroll--lg"
        : "table-scroll--md";

  return (
    <div
      className={`table-scroll ${sizeClass} w-full max-w-full min-w-0 ${maxHeightClass} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
