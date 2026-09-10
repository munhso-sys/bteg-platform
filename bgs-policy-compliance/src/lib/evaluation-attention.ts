import type { ComplianceEvaluation } from "@/lib/types";

/** Older local/remote rows may omit the flag. */
export function isExcludedFromAverage(
  e: Pick<ComplianceEvaluation, "exclude_from_average"> | null | undefined,
): boolean {
  return e?.exclude_from_average === true;
}

export function scoresForAverage(
  evals: Array<Pick<ComplianceEvaluation, "score" | "exclude_from_average">>,
): number[] {
  return evals
    .filter((e) => !isExcludedFromAverage(e))
    .map((e) => e.score)
    .filter((s) => Number.isFinite(s));
}

export type AttentionEvalItem = {
  evaluationId: string;
  policyId: string;
  policyName: string;
  clauseId: string;
  clauseRef: string | null;
  clauseText: string;
  positionId: string;
  positionName: string;
  score: number;
  comment: string | null;
  evidence: string | null;
  evaluatedAt: string;
  href: string;
};
