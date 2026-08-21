export function num(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

export function isoDay(value: unknown): string | null {
  if (value == null || value === "") return null;
  const day = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

export function formatNumber(value: number, digits = 0): string {
  return value.toLocaleString("mn-MN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

export function asRows(data: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(data)) return [];
  return data.filter(
    (row): row is Record<string, unknown> =>
      typeof row === "object" && row !== null && !Array.isArray(row),
  );
}
