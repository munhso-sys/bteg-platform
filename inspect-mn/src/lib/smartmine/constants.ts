export const SMARTMINE_DEFAULT_FROM = "2026-01-01";

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function defaultSmartMineRange() {
  return { from: SMARTMINE_DEFAULT_FROM, to: todayIso() };
}
