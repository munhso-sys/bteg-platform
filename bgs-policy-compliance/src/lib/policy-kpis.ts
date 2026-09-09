import type { ResponsibilityType } from "@/lib/types";

export type LinkScoreRow = {
  id: string;
  policy_clause_id: string;
  job_position_id: string;
  responsibility_type: ResponsibilityType;
  positionName: string;
  score: number | null;
  notes: string | null;
  heltesName?: string | null;
  albaName?: string | null;
};

export type ScopeKpis = {
  linkCount: number;
  positionCount: number;
  avgScore: number | null;
  unevaluatedCount: number;
  evaluatedCount: number;
};

export function computeScopeKpis(rows: LinkScoreRow[]): ScopeKpis {
  const positionIds = new Set(rows.map((r) => r.job_position_id));
  const scores = rows
    .map((r) => r.score)
    .filter((s): s is number => s != null && Number.isFinite(s));
  const unevaluatedCount = rows.filter((r) => r.score == null).length;
  const avgScore =
    scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : null;
  return {
    linkCount: rows.length,
    positionCount: positionIds.size,
    avgScore,
    unevaluatedCount,
    evaluatedCount: scores.length,
  };
}

/** Unevaluated first, then score ascending. */
export function sortLinksByScoreAsc(rows: LinkScoreRow[]): LinkScoreRow[] {
  return [...rows].sort((a, b) => {
    if (a.score == null && b.score == null) {
      return a.positionName.localeCompare(b.positionName, "mn");
    }
    if (a.score == null) return -1;
    if (b.score == null) return 1;
    if (a.score !== b.score) return a.score - b.score;
    return a.positionName.localeCompare(b.positionName, "mn");
  });
}

export function scoreKey(
  clauseId: string,
  positionId: string,
  type: ResponsibilityType,
) {
  return `${clauseId}:${positionId}:${type}`;
}
