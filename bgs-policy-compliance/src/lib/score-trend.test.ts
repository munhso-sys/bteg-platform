import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPositionScoreTrend } from "./score-trend";
import type {
  ComplianceEvaluation,
  JobDescriptionEvaluation,
} from "@/lib/types";

function ce(
  partial: Partial<ComplianceEvaluation> &
    Pick<
      ComplianceEvaluation,
      "policy_clause_id" | "responsibility_type" | "score" | "evaluation_period"
    >,
): ComplianceEvaluation {
  return {
    id: partial.id ?? `e-${Math.random()}`,
    job_position_id: partial.job_position_id ?? "pos-1",
    period_start: null,
    period_end: null,
    evaluator_user_id: null,
    status: "compliant",
    comment: null,
    evaluated_at: partial.evaluated_at ?? `${partial.evaluation_period}-15T00:00:00Z`,
    created_at: partial.evaluated_at ?? `${partial.evaluation_period}-15T00:00:00Z`,
    updated_at: partial.evaluated_at ?? `${partial.evaluation_period}-15T00:00:00Z`,
    ...partial,
  };
}

describe("buildPositionScoreTrend", () => {
  it("aggregates by period with duty types and T-score", () => {
    const compliance: ComplianceEvaluation[] = [
      ce({
        policy_clause_id: "c1",
        responsibility_type: "IMPLEMENTATION",
        score: 80,
        evaluation_period: "2026-08",
      }),
      ce({
        policy_clause_id: "c2",
        responsibility_type: "MONITORING",
        score: 60,
        evaluation_period: "2026-08",
      }),
      ce({
        policy_clause_id: "c1",
        responsibility_type: "IMPLEMENTATION",
        score: 90,
        evaluation_period: "2026-09",
      }),
    ];
    const description: JobDescriptionEvaluation[] = [
      {
        id: "t1",
        job_position_id: "pos-1",
        evaluation_period: "2026-09",
        score: 75,
        result_text: null,
        improvement_actions: null,
        conclusion: null,
        evaluated_at: "2026-09-10T00:00:00Z",
        created_at: "2026-09-10T00:00:00Z",
        updated_at: "2026-09-10T00:00:00Z",
      },
    ];

    const { points, snapshot } = buildPositionScoreTrend({
      complianceEvaluations: compliance,
      descriptionEvaluations: description,
    });

    assert.deepEqual(
      points.map((p) => p.period),
      ["2026-08", "2026-09"],
    );
    assert.equal(points[0].j_avg, 70);
    assert.equal(points[0].implementation, 80);
    assert.equal(points[0].monitoring, 60);
    assert.equal(points[0].t_score, null);
    assert.equal(points[1].implementation, 90);
    assert.equal(points[1].t_score, 75);
    assert.equal(snapshot.t_score, 75);
    assert.equal(snapshot.byType.IMPLEMENTATION, 90);
  });
});
