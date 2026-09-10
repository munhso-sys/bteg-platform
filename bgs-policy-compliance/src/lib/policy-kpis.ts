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
  /** Latest evaluation excluded from averages (urgent attention). */
  excludeFromAverage?: boolean;
  /**
   * Has comment/evidence but still counted in averages
   * (change note / proof — lower priority attention).
   */
  hasCountedNote?: boolean;
  evaluationId?: string | null;
  attentionComment?: string | null;
  attentionEvidence?: string | null;
};

export type ScopeKpis = {
  linkCount: number;
  positionCount: number;
  avgScore: number | null;
  unevaluatedCount: number;
  evaluatedCount: number;
  attentionCount: number;
  /** Counted-in-average notes (comment/evidence). */
  noteCount: number;
};

/** One list row per job position — averages scores across duplicate links in scope. */
export type AggregatedPositionRow = {
  job_position_id: string;
  positionName: string;
  avgScore: number | null;
  linkIds: string[];
  types: ResponsibilityType[];
  primaryType: ResponsibilityType;
  linkCount: number;
  unevaluatedCount: number;
  attentionCount: number;
  noteCount: number;
  excludeFromAverage: boolean;
  hasCountedNote: boolean;
  evaluationIds: string[];
  clauseIds: string[];
  attentionComment: string | null;
  attentionEvidence: string | null;
  heltesName?: string | null;
  albaName?: string | null;
};

export function evaluationHasNote(
  comment?: string | null,
  evidence?: string | null,
): boolean {
  return !!(comment?.trim() || evidence?.trim());
}

export function computeScopeKpis(rows: LinkScoreRow[]): ScopeKpis {
  const positionIds = new Set(rows.map((r) => r.job_position_id));
  const countable = rows.filter(
    (r) =>
      r.score != null &&
      Number.isFinite(r.score) &&
      r.excludeFromAverage !== true,
  );
  const scores = countable.map((r) => r.score as number);
  const unevaluatedCount = rows.filter((r) => r.score == null).length;
  const attentionCount = rows.filter((r) => r.excludeFromAverage === true).length;
  const noteCount = rows.filter((r) => r.hasCountedNote === true).length;
  const avgScore =
    scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
      : null;
  return {
    linkCount: rows.length,
    positionCount: positionIds.size,
    avgScore,
    unevaluatedCount,
    evaluatedCount: rows.filter(
      (r) => r.score != null && Number.isFinite(r.score),
    ).length,
    attentionCount,
    noteCount,
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

/**
 * Collapse duplicate job-position links in a scope into unique rows with
 * average score (descendant / multi-clause fan-out).
 */
export function aggregateLinksByPosition(
  rows: LinkScoreRow[],
): AggregatedPositionRow[] {
  const byPosition = new Map<string, LinkScoreRow[]>();
  for (const r of rows) {
    const list = byPosition.get(r.job_position_id) ?? [];
    list.push(r);
    byPosition.set(r.job_position_id, list);
  }

  const aggregated: AggregatedPositionRow[] = [];
  for (const [job_position_id, list] of byPosition) {
    const countableScores = list
      .filter((r) => r.excludeFromAverage !== true)
      .map((r) => r.score)
      .filter((s): s is number => s != null && Number.isFinite(s));
    const attentionRows = list.filter((r) => r.excludeFromAverage === true);
    const noteRows = list.filter((r) => r.hasCountedNote === true);
    const typeCounts = new Map<ResponsibilityType, number>();
    for (const r of list) {
      typeCounts.set(
        r.responsibility_type,
        (typeCounts.get(r.responsibility_type) ?? 0) + 1,
      );
    }
    const types = [...typeCounts.keys()];
    types.sort((a, b) => (typeCounts.get(b) ?? 0) - (typeCounts.get(a) ?? 0));
    const primaryType = types[0] ?? list[0]!.responsibility_type;
    const attentionComment =
      attentionRows.map((r) => r.attentionComment).find((c) => c?.trim()) ??
      noteRows.map((r) => r.attentionComment).find((c) => c?.trim()) ??
      list.map((r) => r.attentionComment).find((c) => c?.trim()) ??
      null;
    const attentionEvidence =
      attentionRows.map((r) => r.attentionEvidence).find((c) => c?.trim()) ??
      noteRows.map((r) => r.attentionEvidence).find((c) => c?.trim()) ??
      list.map((r) => r.attentionEvidence).find((c) => c?.trim()) ??
      null;
    aggregated.push({
      job_position_id,
      positionName: list[0]!.positionName,
      avgScore:
        countableScores.length > 0
          ? Math.round(
              (countableScores.reduce((a, b) => a + b, 0) /
                countableScores.length) *
                10,
            ) / 10
          : null,
      linkIds: list.map((r) => r.id),
      types,
      primaryType,
      linkCount: list.length,
      unevaluatedCount: list.filter((r) => r.score == null).length,
      attentionCount: attentionRows.length,
      noteCount: noteRows.length,
      excludeFromAverage: attentionRows.length > 0,
      hasCountedNote: noteRows.length > 0,
      evaluationIds: list
        .map((r) => r.evaluationId)
        .filter((id): id is string => !!id),
      clauseIds: [...new Set(list.map((r) => r.policy_clause_id))],
      attentionComment,
      attentionEvidence,
      heltesName: list[0]!.heltesName,
      albaName: list[0]!.albaName,
    });
  }

  return aggregated.sort((a, b) => {
    if (a.avgScore == null && b.avgScore == null) {
      return a.positionName.localeCompare(b.positionName, "mn");
    }
    if (a.avgScore == null) return -1;
    if (b.avgScore == null) return 1;
    if (a.avgScore !== b.avgScore) return a.avgScore - b.avgScore;
    return a.positionName.localeCompare(b.positionName, "mn");
  });
}

/** Self + all descendant clause ids via parent_id. */
export function expandClauseIdsWithDescendants(
  rootId: string,
  clauses: Array<{ id: string; parentId?: string | null }>,
): string[] {
  const children = new Map<string, string[]>();
  for (const c of clauses) {
    const parent = c.parentId ?? null;
    if (!parent) continue;
    const list = children.get(parent) ?? [];
    list.push(c.id);
    children.set(parent, list);
  }
  const out: string[] = [];
  const walk = (id: string) => {
    out.push(id);
    for (const childId of children.get(id) ?? []) walk(childId);
  };
  walk(rootId);
  return out;
}

export function scoreKey(
  clauseId: string,
  positionId: string,
  type: ResponsibilityType,
) {
  return `${clauseId}:${positionId}:${type}`;
}
