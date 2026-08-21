import { getDb, latestEvaluations } from "@/lib/db/repository";

export type PolicyRiskSignal = {
  id: string;
  source: "policy";
  sourceLabel: string;
  title: string;
  description: string;
  unit: string;
  owner: string;
  severity: "low" | "medium" | "high" | "critical";
  score: number;
  status: "open" | "in_progress" | "overdue" | "mitigated";
  likelihood: number;
  impact: number;
  mitigation: {
    summary: string;
    progressPercent: number;
    dueDate: string | null;
    workStatus: string;
  };
  href: string;
  updatedAt: string;
};

function severityFromScore(score: number): PolicyRiskSignal["severity"] {
  if (score < 25) return "critical";
  if (score < 40) return "high";
  if (score < 60) return "medium";
  return "low";
}

function isAtRisk(status: string, score: number) {
  if (status === "compliant" || status === "not_applicable") return false;
  if (status === "non_compliant") return true;
  if (status === "partially_compliant") return true;
  if (status === "in_progress" || status === "not_started") return score < 80;
  return score < 60;
}

export async function policyRiskSignals(): Promise<PolicyRiskSignal[]> {
  const db = await getDb();
  const latest = latestEvaluations(db.compliance_evaluations);
  const clauseById = new Map(db.policy_clauses.map((c) => [c.id, c]));
  const policyById = new Map(db.policies.map((p) => [p.id, p]));
  const positionById = new Map(db.job_positions.map((p) => [p.id, p]));

  const items: PolicyRiskSignal[] = [];

  for (const e of latest) {
    if (!isAtRisk(e.status, e.score)) continue;
    const clause = clauseById.get(e.policy_clause_id);
    if (!clause || clause.is_deleted) continue;
    const policy = policyById.get(clause.policy_id);
    const position = positionById.get(e.job_position_id);
    const residual = Math.max(0, Math.min(100, 100 - (e.score || 0)));
    const severity = severityFromScore(e.score);
    const impact = severity === "critical" ? 5 : severity === "high" ? 4 : severity === "medium" ? 3 : 2;
    let status: PolicyRiskSignal["status"] = "open";
    if (e.status === "in_progress") status = "in_progress";
    else if (e.status === "partially_compliant") status = "in_progress";

    const workStatus =
      e.status === "non_compliant"
        ? "Журам хангаагүй"
        : e.status === "partially_compliant"
          ? "Хэсэгчилсэн биелэлт"
          : e.status === "in_progress"
            ? "Үнэлгээ явж буй"
            : "Эхлээгүй";

    items.push({
      id: `pol-${e.id}`,
      source: "policy",
      sourceLabel: "Журмын биелэлт",
      title: clause.reference_number
        ? `${clause.reference_number} · ${(clause.text || "").slice(0, 90)}`
        : (clause.text || policy?.name || "Журмын заалт").slice(0, 110),
      description: [policy?.name, e.evaluation_period, e.comment]
        .filter(Boolean)
        .join(" · "),
      unit: position?.heltes_name || position?.alba_name || position?.organization_name || "—",
      owner: position?.name || "—",
      severity,
      score: residual,
      status,
      likelihood: impact,
      impact,
      mitigation: {
        summary:
          e.comment?.trim() ||
          "Журмын заалтын биелэлтийг нэмэгдүүлэх, нотлох баримт бүрдүүлэх",
        progressPercent: Math.max(0, Math.min(100, e.score || 0)),
        dueDate: e.period_end,
        workStatus,
      },
      href: `/evaluations`,
      updatedAt: e.updated_at || e.evaluated_at,
    });
  }

  items.sort((a, b) => b.score - a.score);
  return items.slice(0, 80);
}
