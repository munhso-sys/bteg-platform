import { cn } from "@/lib/cn";
import type { SyncStatus } from "@/lib/smartmine/types";

export function SyncStatusChip({ sync }: { sync: SyncStatus | null }) {
  if (!sync) {
    return (
      <span className="rounded-md border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--muted)]">
        Sync —
      </span>
    );
  }
  const label = sync.latestStatus ?? (sync.jobs === 0 ? "job алга" : "unknown");
  const when = sync.latestStartedAt
    ? sync.latestStartedAt.slice(0, 16).replace("T", " ")
    : null;
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium",
        sync.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200"
          : "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200",
      )}
      title={sync.source}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          sync.ok ? "bg-emerald-500" : "bg-rose-500",
        )}
      />
      <span className="truncate">
        Sync {label}
        {when ? ` · ${when.slice(0, 16)}` : ""}
      </span>
    </span>
  );
}
