import type { RowStatus } from "@/lib/placeholder-data";
import type { ReportRow } from "@/lib/reports/types";

export function reportRowStatus(status: string): RowStatus {
  if (status === "overdue") return "overdue";
  if (status === "in_progress") return "in_progress";
  if (status === "mitigated" || status === "done") return "done";
  if (status === "draft") return "draft";
  return "open";
}

export function reportSeverityPriority(
  value: string,
): "low" | "medium" | "high" {
  if (value === "critical" || value === "high") return "high";
  if (value === "medium") return "medium";
  return "low";
}

export function matrixTone(likelihood: number, impact: number, count: number) {
  const p = likelihood * impact;
  if (count === 0) {
    return "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)]";
  }
  if (p >= 16) {
    return "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-100";
  }
  if (p >= 9) {
    return "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100";
  }
  return "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100";
}

export function formatGeneratedAt(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("mn-MN");
}

export function kpiExportRows(
  kpis: { label: string; value: string; hint: string; level: string; system: string }[],
) {
  return [
    ["Үзүүлэлт", "Утга", "Тайлбар", "Түвшин", "Систем"],
    ...kpis.map((k) => [k.label, k.value, k.hint, k.level, k.system]),
  ];
}

export function signalExportRows(rows: ReportRow[]) {
  return [
    ["Систем", "Гарчиг", "Үнэлгээ", "Зэрэг", "Төлөв", "Хариуцагч", "Нэгж", "Огноо"],
    ...rows.map((r) => [
      r.system,
      r.title,
      r.metric,
      r.value,
      r.status,
      r.owner,
      r.unit,
      r.date,
    ]),
  ];
}
