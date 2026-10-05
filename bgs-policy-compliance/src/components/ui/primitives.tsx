import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1 basis-[min(100%,16rem)]">
        <h1 className="text-lg font-semibold tracking-tight break-words sm:text-xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-0.5 text-sm text-[var(--muted)] break-words">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}

export function Panel({
  children,
  className,
  title,
  actions,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
  actions?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "min-w-0 max-w-full overflow-hidden rounded border border-[var(--border)] bg-[var(--card)]",
        className,
      )}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
          <h2 className="min-w-0 truncate text-sm font-semibold text-[var(--fg)]">{title}</h2>
          {actions}
        </div>
      )}
      <div className="max-w-full p-3">{children}</div>
    </section>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  compact,
}: {
  label: string;
  value: string | number;
  hint?: string;
  /** Smaller value text for long labels (e.g. unit names). */
  compact?: boolean;
}) {
  return (
    <div className="rounded border border-[var(--border)] bg-[var(--card)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div
        className={cn(
          "mt-1 font-semibold leading-snug",
          compact ? "text-sm" : "text-2xl tabular-nums",
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-[10px] text-[var(--muted)]">{hint}</div> : null}
    </div>
  );
}

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ScoreChip({ score }: { score: number | null | undefined }) {
  if (score == null) {
    return (
      <Badge className="bg-slate-100 text-slate-600 dark:bg-[var(--surface-muted)] dark:text-[var(--muted)]">
        Үнэлгээгүй
      </Badge>
    );
  }
  const tone =
    score >= 90
      ? "bg-emerald-100 text-emerald-800"
      : score >= 70
        ? "bg-lime-100 text-lime-800"
        : score >= 40
          ? "bg-amber-100 text-amber-900"
          : score > 0
            ? "bg-orange-100 text-orange-900"
            : "bg-rose-100 text-rose-800";
  return <Badge className={tone}>{score}</Badge>;
}
