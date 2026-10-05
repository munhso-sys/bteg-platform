import { RESPONSIBILITY_SHORT } from "@/lib/constants";
import { isExcludedFromAverage, scoresForAverage } from "@/lib/evaluation-attention";
import type {
  ComplianceEvaluation,
  JobDescriptionEvaluation,
  ResponsibilityType,
} from "@/lib/types";

const DUTY_TYPES: ResponsibilityType[] = [
  "IMPLEMENTATION",
  "MONITORING",
  "VERIFICATION",
  "DEPLOYMENT",
];

export type ScoreTrendPoint = {
  /** Үнэлгээний үе (жнь. 2026-08) */
  period: string;
  /** Ж-үнэлгээ — нийт дундаж */
  j_avg: number | null;
  implementation: number | null;
  monitoring: number | null;
  verification: number | null;
  deployment: number | null;
  /** Т-үнэлгээ — АБТ */
  t_score: number | null;
  /** Тухайн үеийн Ж дундажид орсон үнэлгээний тоо */
  j_count: number;
};

export type ScoreSnapshot = {
  j_avg: number | null;
  byType: Record<ResponsibilityType, number | null>;
  typeCounts: Record<ResponsibilityType, number>;
  t_score: number | null;
  t_period: string | null;
  j_period: string | null;
  j_count: number;
};

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

function periodKey(
  period: string | null | undefined,
  evaluatedAt: string | null | undefined,
): string {
  const p = (period ?? "").trim();
  if (/^\d{4}-\d{2}/.test(p)) return p.slice(0, 7);
  if (p) return p;
  const at = (evaluatedAt ?? "").slice(0, 7);
  return /^\d{4}-\d{2}$/.test(at) ? at : "Тодорхойгүй";
}

function evaluationLinkKey(e: Pick<
  ComplianceEvaluation,
  "policy_clause_id" | "job_position_id" | "responsibility_type"
>) {
  return `${e.policy_clause_id}:${e.job_position_id}:${e.responsibility_type}`;
}

/** Latest evaluation per clause×type among rows (already period-filtered or cumulative). */
function latestByLink(evals: ComplianceEvaluation[]): ComplianceEvaluation[] {
  const map = new Map<string, ComplianceEvaluation>();
  for (const e of [...evals].sort(
    (a, b) =>
      new Date(b.evaluated_at).getTime() - new Date(a.evaluated_at).getTime(),
  )) {
    const key = evaluationLinkKey(e);
    if (!map.has(key)) map.set(key, e);
  }
  return [...map.values()];
}

function averagesFromLatest(latest: ComplianceEvaluation[]) {
  const included = latest.filter((e) => !isExcludedFromAverage(e));
  const byType: Record<ResponsibilityType, number[]> = {
    IMPLEMENTATION: [],
    MONITORING: [],
    VERIFICATION: [],
    DEPLOYMENT: [],
  };
  for (const e of included) {
    byType[e.responsibility_type]?.push(e.score);
  }
  return {
    j_avg: avg(scoresForAverage(included)),
    j_count: included.length,
    implementation: avg(byType.IMPLEMENTATION),
    monitoring: avg(byType.MONITORING),
    verification: avg(byType.VERIFICATION),
    deployment: avg(byType.DEPLOYMENT),
    typeCounts: {
      IMPLEMENTATION: byType.IMPLEMENTATION.length,
      MONITORING: byType.MONITORING.length,
      VERIFICATION: byType.VERIFICATION.length,
      DEPLOYMENT: byType.DEPLOYMENT.length,
    } as Record<ResponsibilityType, number>,
    byType: {
      IMPLEMENTATION: avg(byType.IMPLEMENTATION),
      MONITORING: avg(byType.MONITORING),
      VERIFICATION: avg(byType.VERIFICATION),
      DEPLOYMENT: avg(byType.DEPLOYMENT),
    } as Record<ResponsibilityType, number | null>,
  };
}

/**
 * Үе бүрийн эцэст (cumulative as-of) Ж/үүргийн төрөл/Т онооны хандлага.
 * X тэнхлэг = evaluation_period (YYYY-MM), давхардсан өдрийг арилгана.
 */
export function buildPositionScoreTrend(input: {
  complianceEvaluations: ComplianceEvaluation[];
  descriptionEvaluations: JobDescriptionEvaluation[];
}): { points: ScoreTrendPoint[]; snapshot: ScoreSnapshot } {
  const ce = input.complianceEvaluations ?? [];
  const te = [...(input.descriptionEvaluations ?? [])].sort(
    (a, b) =>
      new Date(b.evaluated_at).getTime() - new Date(a.evaluated_at).getTime(),
  );

  const periodSet = new Set<string>();
  for (const e of ce) {
    periodSet.add(periodKey(e.evaluation_period, e.evaluated_at));
  }
  for (const e of te) {
    periodSet.add(periodKey(e.evaluation_period, e.evaluated_at));
  }
  const periods = [...periodSet]
    .filter((p) => p !== "Тодорхойгүй")
    .sort((a, b) => a.localeCompare(b));

  if (periods.length === 0 && (ce.length || te.length)) {
    periods.push("Тодорхойгүй");
  }

  const points: ScoreTrendPoint[] = periods.map((period) => {
    const ceAsOf = ce.filter(
      (e) => periodKey(e.evaluation_period, e.evaluated_at).localeCompare(period) <= 0,
    );
    const latest = latestByLink(ceAsOf);
    const av = averagesFromLatest(latest);

    const tAsOf = te.find(
      (e) => periodKey(e.evaluation_period, e.evaluated_at).localeCompare(period) <= 0,
    );

    return {
      period,
      j_avg: av.j_avg,
      implementation: av.implementation,
      monitoring: av.monitoring,
      verification: av.verification,
      deployment: av.deployment,
      t_score: tAsOf != null ? tAsOf.score : null,
      j_count: av.j_count,
    };
  });

  const latestAll = latestByLink(ce);
  const snap = averagesFromLatest(latestAll);
  const latestT = te[0] ?? null;

  return {
    points,
    snapshot: {
      j_avg: snap.j_avg,
      byType: snap.byType,
      typeCounts: snap.typeCounts,
      t_score: latestT?.score ?? null,
      t_period: latestT
        ? periodKey(latestT.evaluation_period, latestT.evaluated_at)
        : null,
      j_period: points.length ? points[points.length - 1].period : null,
      j_count: snap.j_count,
    },
  };
}

export const SCORE_TREND_SERIES = [
  {
    key: "j_avg" as const,
    label: "Ж-үнэлгээ (нийт)",
    color: "#0f172a",
    strokeWidth: 2.5,
  },
  {
    key: "implementation" as const,
    label: RESPONSIBILITY_SHORT.IMPLEMENTATION,
    color: "#2563eb",
    strokeWidth: 1.75,
  },
  {
    key: "monitoring" as const,
    label: RESPONSIBILITY_SHORT.MONITORING,
    color: "#d97706",
    strokeWidth: 1.75,
  },
  {
    key: "verification" as const,
    label: RESPONSIBILITY_SHORT.VERIFICATION,
    color: "#059669",
    strokeWidth: 1.75,
  },
  {
    key: "deployment" as const,
    label: RESPONSIBILITY_SHORT.DEPLOYMENT,
    color: "#7c3aed",
    strokeWidth: 1.75,
  },
  {
    key: "t_score" as const,
    label: "Т-үнэлгээ (АБТ)",
    color: "#e11d48",
    strokeWidth: 2,
    dashed: true,
  },
];

export { DUTY_TYPES };
