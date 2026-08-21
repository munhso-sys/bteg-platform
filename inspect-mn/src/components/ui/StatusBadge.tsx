import { cn } from "@/lib/cn";
import type { RowStatus } from "@/lib/placeholder-data";

const STATUS_LABEL: Record<RowStatus, string> = {
  open: "Нээлттэй",
  in_progress: "Явж буй",
  done: "Дууссан",
  overdue: "Хэтэрсэн",
  draft: "Ноорог",
};

const STATUS_CLASS: Record<RowStatus, string> = {
  open: "border-slate-200 bg-slate-100 text-slate-700",
  in_progress: "border-amber-200 bg-amber-50 text-amber-800",
  done: "border-emerald-200 bg-emerald-50 text-emerald-700",
  overdue: "border-rose-200 bg-rose-50 text-rose-700",
  draft: "border-orange-200 bg-orange-50 text-orange-800",
};

export function StatusBadge({ status }: { status: RowStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium",
        STATUS_CLASS[status],
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function PriorityBadge({
  priority,
}: {
  priority: "low" | "medium" | "high";
}) {
  const map = {
    low: "border-slate-200 bg-slate-100 text-slate-700",
    medium: "border-orange-200 bg-orange-50 text-orange-800",
    high: "border-rose-200 bg-rose-50 text-rose-700",
  } as const;
  const label = { low: "Бага", medium: "Дунд", high: "Өндөр" } as const;
  return (
    <span
      className={cn(
        "inline-flex rounded border px-2 py-0.5 text-xs font-medium",
        map[priority],
      )}
    >
      {label[priority]}
    </span>
  );
}
