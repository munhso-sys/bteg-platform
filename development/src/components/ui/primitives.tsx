import type { ReactNode } from "react";

export function MetricCard({
  label,
  value,
  hint,
  tone = "default",
  className = "",
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "ok" | "warn" | "danger" | "brand";
  className?: string;
  onClick?: () => void;
}) {
  const bar: Record<string, string> = {
    default: "border-l-slate-400",
    ok: "border-l-emerald-500",
    warn: "border-l-amber-500",
    danger: "border-l-rose-500",
    brand: "border-l-[var(--brand)]",
  };
  const classNames = `flex w-full flex-col items-start justify-center rounded-md border border-[var(--border)] border-l-4 bg-[var(--card)] px-3 py-2.5 text-left ${bar[tone]} ${
    onClick ? "cursor-pointer transition hover:bg-slate-50" : ""
  } ${className}`.trim();

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classNames}>
        <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
          {label}
        </div>
        <div className="mt-1 text-2xl font-semibold leading-none tabular-nums text-[var(--fg)]">
          {value}
        </div>
        {hint ? (
          <div className="mt-1 text-xs leading-snug text-[var(--muted)]">{hint}</div>
        ) : null}
      </button>
    );
  }

  return (
    <div className={classNames}>
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
  description,
  children,
  actions,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-md border border-[var(--border)] bg-[var(--card)]">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
        <div className="min-w-0">
          <h2 className="min-w-0 text-sm font-semibold leading-snug text-[var(--fg)]">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-xs text-[var(--muted)]">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      <div className="h-scroll min-w-0 max-w-full p-3">{children}</div>
    </section>
  );
}

export function TableScroll({
  children,
  className = "",
  maxHeightClass = "max-h-[32rem]",
}: {
  children: ReactNode;
  className?: string;
  maxHeightClass?: string;
}) {
  return (
    <div
      className={`soft-scroll w-full max-w-full min-w-0 overflow-auto rounded-md border border-[var(--border)] ${maxHeightClass} ${className}`.trim()}
    >
      {children}
    </div>
  );
}
