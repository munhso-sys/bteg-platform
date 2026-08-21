import type {
  InspectionAnswer,
  InspectionScoreSnapshot,
  RiskLevel,
  RiskThresholds,
} from "@/lib/types";
import { DEFAULT_RISK_THRESHOLDS } from "@/lib/types";

export function mapRiskLevel(
  riskPercent: number,
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS,
): RiskLevel {
  if (riskPercent < thresholds.lowMaxExclusive) return "Бага";
  if (riskPercent < thresholds.mediumMaxExclusive) return "Дунд";
  return "Их";
}

export function deriveComplianceStatus(
  isApplicable: boolean,
  approvedScore: number,
  receivedScore: number,
): InspectionAnswer["complianceStatus"] {
  if (!isApplicable) return "not_applicable";
  const failedScore = Math.max(0, receivedScore || 0);
  if (failedScore <= 0) return "pass";
  if (approvedScore <= 0 || failedScore >= approvedScore) return "fail";
  return "partial";
}

export interface ScoreInputAnswer {
  isApplicable: boolean;
  approvedScore: number;
  receivedScore: number;
}

export function calculateRunScore(
  answers: ScoreInputAnswer[],
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS,
): Omit<InspectionScoreSnapshot, "id" | "runId" | "calculatedAt"> {
  const applicable = answers.filter((a) => a.isApplicable);
  const applicableQuestionCount = applicable.length;
  const passedQuestionCount = applicable.filter(
    (a) => Math.max(0, a.receivedScore || 0) <= 0,
  ).length;
  const failedQuestionCount = applicableQuestionCount - passedQuestionCount;
  const approvedScoreTotal = applicable.reduce(
    (sum, a) => sum + (a.approvedScore || 0),
    0,
  );
  const failedScoreTotal = applicable.reduce(
    (sum, a) =>
      sum +
      Math.min(
        Math.max(0, a.receivedScore || 0),
        Math.max(0, a.approvedScore || 0),
      ),
    0,
  );
  const compliancePercent =
    approvedScoreTotal > 0
      ? Math.max(0, approvedScoreTotal - failedScoreTotal) / approvedScoreTotal
      : 0;
  const riskPercent =
    approvedScoreTotal > 0 ? failedScoreTotal / approvedScoreTotal : 0;

  return {
    applicableQuestionCount,
    passedQuestionCount,
    failedQuestionCount,
    approvedScoreTotal,
    receivedScoreTotal: failedScoreTotal,
    compliancePercent,
    failedScoreTotal,
    riskPercent,
    riskLevel: mapRiskLevel(riskPercent, thresholds),
  };
}

export function formatPercent(ratio: number, digits = 1): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

export function averageProgress(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function actionCompletionRate(
  closedCount: number,
  totalCount: number,
): number {
  if (totalCount === 0) return 0;
  return closedCount / totalCount;
}
