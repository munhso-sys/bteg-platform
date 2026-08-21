import {
  defaultSmartMineRange,
  SMARTMINE_DEFAULT_FROM,
  todayIso,
} from "./constants";

export type DateRange = { from: string; to: string };

function isIsoDate(value: string | null | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export function parseSmartMineRange(searchParams: URLSearchParams): DateRange {
  const fallback = defaultSmartMineRange();
  let from = isIsoDate(searchParams.get("from"))
    ? searchParams.get("from")!
    : fallback.from;
  let to = isIsoDate(searchParams.get("to"))
    ? searchParams.get("to")!
    : fallback.to;
  if (from > to) {
    const tmp = from;
    from = to;
    to = tmp;
  }
  if (from < SMARTMINE_DEFAULT_FROM && !searchParams.get("from")) {
    from = SMARTMINE_DEFAULT_FROM;
  }
  if (to > todayIso() && !searchParams.get("to")) {
    to = todayIso();
  }
  return { from, to };
}

export function addDaysIso(isoDate: string, deltaDays: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return isoDate.slice(0, 10);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

export function daysBetweenInclusive(from: string, to: string): number {
  const a = new Date(`${from.slice(0, 10)}T00:00:00.000Z`);
  const b = new Date(`${to.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 1;
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1);
}

export function eachDay(from: string, to: string): string[] {
  const days: string[] = [];
  let cursor = from.slice(0, 10);
  const end = to.slice(0, 10);
  while (cursor <= end) {
    days.push(cursor);
    cursor = addDaysIso(cursor, 1);
    if (days.length > 800) break;
  }
  return days;
}
