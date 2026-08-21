import type { ProgramStatus } from "@/lib/types";

const LABELS: Record<ProgramStatus, string> = {
  planned: "Төлөвлөсөн",
  in_progress: "Явагдаж буй",
  completed: "Дууссан",
  delayed: "Хоцролттой",
};

export function StatusBadge({ status }: { status: ProgramStatus }) {
  return <span className={`status status-${status}`}>{LABELS[status]}</span>;
}
