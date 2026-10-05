import type { PositionReviewRow } from "@/lib/org-assign";
import type { PositionPreviewExportModel } from "@/lib/position-preview-document";
import { buildPositionScoreTrend } from "@/lib/score-trend";
import { getPositionDetail } from "@/lib/db/repository";

type PositionDetail = NonNullable<Awaited<ReturnType<typeof getPositionDetail>>>;

export function buildPositionPreviewExportModel(
  detail: PositionDetail,
  reviewRow?: PositionReviewRow | null,
): PositionPreviewExportModel {
  const { points, snapshot } = buildPositionScoreTrend({
    complianceEvaluations: detail.evaluations,
    descriptionEvaluations: detail.descriptionEvaluations,
  });

  return {
    position: detail.position,
    organizationName:
      reviewRow?.organization_name?.trim() ||
      detail.position.organization_name?.trim() ||
      "—",
    heltes:
      reviewRow?.heltes ||
      detail.position.heltes_name ||
      detail.orgScope.unitLabel ||
      "—",
    alba: reviewRow?.alba || detail.position.alba_name || "—",
    kpis: {
      j_avg: reviewRow?.policy_avg_score ?? detail.avgScore ?? snapshot.j_avg,
      policy_count: reviewRow?.policy_count ?? detail.counts.policies,
      clause_count: reviewRow?.clause_count ?? detail.counts.clauses,
      t_score:
        detail.descriptionEvaluation?.score ??
        reviewRow?.description_score ??
        null,
    },
    obligations: detail.obligations,
    trendPoints: points,
    trendSnapshot: snapshot,
    description: detail.description,
    descriptionEvaluation: detail.descriptionEvaluation,
  };
}
