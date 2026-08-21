import type {
  ProgramInitiative,
  ProgramStatus,
  QuarterKey,
  QuarterMark,
} from "./types";

export const QUARTER_ORDER: QuarterKey[] = ["q1", "q2", "q3", "q4"];

export const QUARTER_META: Array<{
  key: QuarterKey;
  label: string;
  months: string;
  startMonth: number;
  endMonth: number;
}> = [
  { key: "q1", label: "I", months: "1–3 сар", startMonth: 1, endMonth: 3 },
  { key: "q2", label: "II", months: "4–6 сар", startMonth: 4, endMonth: 6 },
  { key: "q3", label: "III", months: "7–9 сар", startMonth: 7, endMonth: 9 },
  { key: "q4", label: "IV", months: "10–12 сар", startMonth: 10, endMonth: 12 },
];

export type QuarterView = "none" | "planned" | "done" | "delayed";

export function calendarQuarter(date = new Date()) {
  const month = date.getMonth() + 1;
  const key: QuarterKey =
    month <= 3 ? "q1" : month <= 6 ? "q2" : month <= 9 ? "q3" : "q4";
  return { year: date.getFullYear(), key, month };
}

export function quarterEnd(year: number, key: QuarterKey) {
  const endMonth = QUARTER_META.find((q) => q.key === key)?.endMonth ?? 12;
  return new Date(year, endMonth, 0, 23, 59, 59, 999);
}

export function isQuarterCurrent(
  year: number,
  key: QuarterKey,
  now = new Date(),
) {
  const current = calendarQuarter(now);
  return current.year === year && current.key === key;
}

export function isQuarterPast(year: number, key: QuarterKey, now = new Date()) {
  return now > quarterEnd(year, key);
}

export function emptyQuarters(): Record<QuarterKey, QuarterMark> {
  return { q1: "none", q2: "none", q3: "none", q4: "none" };
}

export function nextQuarterMark(mark: QuarterMark): QuarterMark {
  if (mark === "none") return "planned";
  if (mark === "planned") return "done";
  return "none";
}

export function quartersFromDates(
  start: string,
  end: string,
  year: number,
): Record<QuarterKey, QuarterMark> {
  const result = emptyQuarters();
  if (!start && !end) return result;
  const rangeStart = start ? new Date(start) : new Date(year, 0, 1);
  const rangeEnd = end ? new Date(end) : new Date(year, 11, 31);
  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
    return result;
  }

  for (const q of QUARTER_META) {
    const qStart = new Date(year, q.startMonth - 1, 1);
    const qEnd = quarterEnd(year, q.key);
    if (rangeStart <= qEnd && rangeEnd >= qStart) {
      result[q.key] = "planned";
    }
  }
  return result;
}

export function resolveQuarterView(
  item: ProgramInitiative,
  key: QuarterKey,
  now = new Date(),
): QuarterView {
  const mark = item.quarters[key] ?? "none";
  if (mark === "done" || (mark !== "none" && item.status === "completed")) {
    return "done";
  }
  if (mark === "none") return "none";
  if (item.year === now.getFullYear() && isQuarterPast(item.year, key, now)) {
    return "delayed";
  }
  return "planned";
}

export function effectiveStatus(
  item: ProgramInitiative,
  now = new Date(),
): ProgramStatus {
  if (item.status === "completed") return "completed";
  const overdue = QUARTER_ORDER.some(
    (key) => resolveQuarterView(item, key, now) === "delayed",
  );
  if (overdue) return "delayed";
  return item.status;
}

export function quarterLabel(key: QuarterKey) {
  return QUARTER_META.find((q) => q.key === key)?.label ?? key;
}
