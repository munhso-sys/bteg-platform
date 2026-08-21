import type { RiskSignal, RiskSource } from "@/lib/risk/types";

export type RiskFilterId =
  | "all"
  | "high"
  | "medium"
  | "low"
  | "in_progress"
  | "overdue"
  | "unplanned";

export const RISK_FILTERS: { id: RiskFilterId; label: string }[] = [
  { id: "all", label: "Бүгд" },
  { id: "high", label: "Өндөр" },
  { id: "medium", label: "Дунд" },
  { id: "low", label: "Бага" },
  { id: "in_progress", label: "Хийгдэж байгаа" },
  { id: "overdue", label: "Хугацаа хэтэрсэн" },
  { id: "unplanned", label: "Төлөвлөгөөгүй" },
];

export const RISK_SOURCE_FILTER: { id: "all" | RiskSource; label: string }[] = [
  { id: "all", label: "Бүх эх үүсвэр" },
  { id: "inspection", label: "Хяналт шалгалт" },
  { id: "policy", label: "Журмын биелэлт" },
  { id: "development", label: "Судалгаа хөгжүүлэлт" },
  { id: "voice", label: "Ажилтны дуу хоолой" },
];

export const RISK_SOURCE_LABEL: Record<RiskSource, string> = {
  inspection: "Хяналт шалгалт",
  policy: "Журмын биелэлт",
  development: "Судалгаа хөгжүүлэлт",
  voice: "Ажилтны дуу хоолой",
};

export function isUnplanned(item: RiskSignal) {
  return item.mitigation.progressPercent <= 0 && item.status !== "in_progress";
}

export function filterRiskItems(
  items: RiskSignal[],
  opts: {
    source?: "all" | RiskSource;
    filter?: RiskFilterId;
    query?: string;
    unit?: string;
  },
) {
  const source = opts.source ?? "all";
  const filter = opts.filter ?? "all";
  const q = (opts.query ?? "").trim().toLowerCase();
  const unit = (opts.unit ?? "").trim().toLowerCase();

  return items.filter((item) => {
    if (source !== "all" && item.source !== source) return false;
    if (unit && item.unit.trim().toLowerCase() !== unit) return false;
    if (filter === "high" && item.severity !== "high" && item.severity !== "critical") {
      return false;
    }
    if (filter === "medium" && item.severity !== "medium") return false;
    if (filter === "low" && item.severity !== "low") return false;
    if (filter === "in_progress" && item.status !== "in_progress") return false;
    if (filter === "overdue" && item.status !== "overdue") return false;
    if (filter === "unplanned" && !isUnplanned(item)) return false;
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.owner.toLowerCase().includes(q) ||
      item.unit.toLowerCase().includes(q)
    );
  });
}

export function parseRiskFilter(raw: string | null): RiskFilterId {
  return RISK_FILTERS.some((f) => f.id === raw) ? (raw as RiskFilterId) : "all";
}

export function parseRiskSource(raw: string | null): "all" | RiskSource {
  return RISK_SOURCE_FILTER.some((s) => s.id === raw)
    ? (raw as "all" | RiskSource)
    : "all";
}
