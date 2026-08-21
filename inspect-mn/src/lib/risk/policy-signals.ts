import { loadAppDataPayload } from "@/lib/risk/store-payload";
import type { RiskSignal, RiskSeverity } from "@/lib/risk/types";

type Clause = {
  id: string;
  policy_id: string;
  reference_number?: string | null;
  text?: string | null;
  is_deleted?: boolean;
};

type Policy = { id: string; name?: string | null };

type Position = {
  id: string;
  name?: string | null;
  heltes_name?: string | null;
  alba_name?: string | null;
  organization_name?: string | null;
};

type Evaluation = {
  id: string;
  policy_clause_id: string;
  job_position_id: string;
  status: string;
  score: number;
  evaluation_period?: string | null;
  period_end?: string | null;
  comment?: string | null;
  updated_at?: string;
  evaluated_at?: string;
};

type PolicyDb = {
  policies?: Policy[];
  policy_clauses?: Clause[];
  job_positions?: Position[];
  compliance_evaluations?: Evaluation[];
};

function severityFromScore(score: number): RiskSeverity {
  if (score < 25) return "critical";
  if (score < 40) return "high";
  if (score < 60) return "medium";
  return "low";
}

function isAtRisk(status: string, score: number) {
  if (status === "compliant" || status === "not_applicable") return false;
  if (status === "non_compliant" || status === "partially_compliant") return true;
  if (status === "in_progress" || status === "not_started") return score < 80;
  return score < 60;
}

function latestEvaluations(rows: Evaluation[]) {
  const map = new Map<string, Evaluation>();
  for (const row of rows) {
    const key = `${row.policy_clause_id}::${row.job_position_id}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, row);
      continue;
    }
    const prevAt = prev.updated_at || prev.evaluated_at || "";
    const nextAt = row.updated_at || row.evaluated_at || "";
    if (nextAt >= prevAt) map.set(key, row);
  }
  return [...map.values()];
}

export async function policySignalsFromStore(): Promise<{
  items: RiskSignal[];
  error?: string;
}> {
  const db = await loadAppDataPayload<PolicyDb>("policy_compliance_db");
  if (!db) {
    return { items: [], error: "policy_compliance_db олдсонгүй" };
  }

  const evaluations = Array.isArray(db.compliance_evaluations)
    ? db.compliance_evaluations
    : [];
  const clauses = Array.isArray(db.policy_clauses) ? db.policy_clauses : [];
  const policies = Array.isArray(db.policies) ? db.policies : [];
  const positions = Array.isArray(db.job_positions) ? db.job_positions : [];

  const clauseById = new Map(clauses.map((c) => [c.id, c]));
  const policyById = new Map(policies.map((p) => [p.id, p]));
  const positionById = new Map(positions.map((p) => [p.id, p]));

  const items: RiskSignal[] = [];
  for (const e of latestEvaluations(evaluations)) {
    if (!isAtRisk(e.status, e.score ?? 0)) continue;
    const clause = clauseById.get(e.policy_clause_id);
    if (!clause || clause.is_deleted) continue;
    const policy = policyById.get(clause.policy_id);
    const position = positionById.get(e.job_position_id);
    const residual = Math.max(0, Math.min(100, 100 - (e.score || 0)));
    const severity = severityFromScore(e.score || 0);
    const impact =
      severity === "critical"
        ? 5
        : severity === "high"
          ? 4
          : severity === "medium"
            ? 3
            : 2;

    let status: RiskSignal["status"] = "open";
    if (e.status === "in_progress" || e.status === "partially_compliant") {
      status = "in_progress";
    }

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
      unit:
        position?.heltes_name ||
        position?.alba_name ||
        position?.organization_name ||
        "—",
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
        dueDate: e.period_end ?? null,
        workStatus,
      },
      href: "/evaluations",
      updatedAt: e.updated_at || e.evaluated_at || new Date().toISOString(),
    });
  }

  items.sort((a, b) => b.score - a.score);
  return { items: items.slice(0, 80) };
}
