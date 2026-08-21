import { getRunScore } from "@/lib/store";
import type {
  CorrectiveAction,
  InspectionCenterData,
  InspectionFinding,
  InspectionRun,
  RiskThresholds,
} from "@/lib/types";
import {
  DEFAULT_RISK_THRESHOLDS,
  normalizeRiskThresholds,
  SEVERITY_LABELS,
} from "@/lib/types";

export function riskScoreForFinding(
  data: InspectionCenterData,
  finding: InspectionFinding,
  run: InspectionRun | undefined,
) {
  const thresholds = normalizeRiskThresholds(data.riskThresholds);
  const snapshot = run ? getRunScore(data, run.id) : null;
  const severityScore = thresholds.severityBase[finding.severity];
  const runRiskScore = snapshot ? Math.round(snapshot.riskPercent * 100) : 0;
  const score = Math.min(100, Math.max(severityScore, runRiskScore));

  return {
    score,
    label: riskLabel(score, thresholds),
    severityScore,
    runRiskScore,
    explanation: `max(ноцтол ${SEVERITY_LABELS[finding.severity]}=${severityScore}%, гүйцэтгэлийн эрсдэл=${runRiskScore}%)`,
  };
}

export function riskLabel(
  score: number,
  thresholds: RiskThresholds = DEFAULT_RISK_THRESHOLDS,
) {
  if (score >= thresholds.findingCriticalMin) return "critical";
  if (score >= thresholds.findingHighMin) return "high";
  if (score >= thresholds.findingMediumMin) return "medium";
  return "low";
}

export function recommendedActionText(
  finding: InspectionFinding,
  action: CorrectiveAction | undefined,
) {
  if (action?.actionText) return action.actionText;
  if (finding.severity === "critical") {
    return "Үйл ажиллагааг түр зогсоох шаардлагатай эсэхийг үнэлж, шуурхай арилгах төлөвлөгөө батлах";
  }
  if (finding.severity === "high") {
    return "Хариуцагч, хугацаа, нотлох баримттай засах арга хэмжээний төлөвлөгөө гаргах";
  }
  if (finding.severity === "medium") {
    return "Шалтгаан тогтоож, давтан гарахаас сэргийлэх арга хэмжээ төлөвлөх";
  }
  return "Хяналтын тэмдэглэлд бүртгэж, дараагийн шалгалтаар баталгаажуулах";
}

export function isFindingResolved(status: InspectionFinding["status"]) {
  return status === "resolved" || status === "closed";
}

export function isActionClosed(action: CorrectiveAction | undefined) {
  return action?.status === "closed" || action?.status === "verified";
}

/** Finding archived on Арилсан: finding status or verified/closed action (incl. 100%). */
export function isFindingEffectivelyResolved(
  finding: InspectionFinding,
  action: CorrectiveAction | undefined,
) {
  if (isFindingResolved(finding.status)) return true;
  if (isActionClosed(action)) return true;
  if (action && action.progressPercent >= 100) return true;
  return false;
}

export function actionDisplayStatus(
  action: CorrectiveAction | undefined,
  today: string,
) {
  if (!action) return "no_action";
  if (action.dueDate && !isActionClosed(action) && action.dueDate < today) {
    return "overdue";
  }
  return action.status;
}

export function dueDateSummary(
  action: CorrectiveAction | undefined,
  today: string,
) {
  if (!action?.dueDate) {
    return { label: "Хугацаа оруулаагүй", tone: "neutral" as const };
  }
  if (isActionClosed(action)) {
    return { label: "Хаагдсан", tone: "ok" as const };
  }

  const todayDate = Date.parse(`${today}T00:00:00.000Z`);
  const dueDate = Date.parse(`${action.dueDate}T00:00:00.000Z`);
  const diffDays = Math.round((dueDate - todayDate) / 86_400_000);

  if (diffDays < 0) {
    return {
      label: `Хугацаа хэтэрсэн ${Math.abs(diffDays)} хоног`,
      tone: "danger" as const,
    };
  }
  if (diffDays <= 7) {
    return { label: `${diffDays} хоног үлдсэн`, tone: "warn" as const };
  }
  return { label: `${diffDays} хоног үлдсэн`, tone: "brand" as const };
}
