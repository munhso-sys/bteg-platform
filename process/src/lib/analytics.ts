import type {
  ProcessAnalytics,
  ProcessHealth,
  ProcessModuleDb,
  RootCauseCategory,
} from "@/lib/types";
import { collectSubtreeIds } from "@/lib/store";

const EMPTY_RCA: Record<RootCauseCategory, number> = {
  PROCESS_GAP: 0,
  HUMAN_ERROR: 0,
  EQUIPMENT_FAILURE: 0,
  ENVIRONMENTAL: 0,
};

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function riskLevelFromScore(
  score: number,
): "low" | "medium" | "high" | "critical" {
  if (score >= 20) return "critical";
  if (score >= 12) return "high";
  if (score >= 6) return "medium";
  return "low";
}

export function deriveHealth(input: {
  openIssues: number;
  criticalOpen: number;
  complianceRate: number;
  riskScore: number;
}): ProcessHealth {
  if (input.criticalOpen > 0 || input.riskScore >= 20) return "red";
  if (input.openIssues > 0 || input.complianceRate < 80 || input.riskScore >= 12) {
    return "yellow";
  }
  if (input.complianceRate >= 80 && input.openIssues === 0) return "green";
  return "neutral";
}

export function computeAnalytics(
  db: ProcessModuleDb,
  processId: string,
): ProcessAnalytics | null {
  const root = db.nodes.find((n) => n.id === processId);
  if (!root) return null;

  const nodeIds = collectSubtreeIds(db.nodes, processId);
  const idSet = new Set(nodeIds);

  const procedures = db.raci_links.filter((l) => idSet.has(l.process_id));
  const inspections = db.inspection_links.filter((l) =>
    idSet.has(l.process_id),
  );
  const issues = db.issue_links.filter((l) => idSet.has(l.process_id));
  const risks = db.risk_links.filter((l) => idSet.has(l.process_id));
  const employee_reports = db.employee_report_links.filter((l) =>
    idSet.has(l.process_id),
  );

  const passRates = inspections
    .map((i) => i.pass_rate)
    .filter((v): v is number => typeof v === "number");
  const inspection_pass_rate = avg(passRates);

  // Compliance proxy: average inspection pass rate, or 100 if no data & has RACI
  let procedure_compliance_rate = 100;
  if (inspection_pass_rate != null) {
    procedure_compliance_rate = Math.round(inspection_pass_rate * 10) / 10;
  } else if (!procedures.length) {
    procedure_compliance_rate = 0;
  }

  const openIssues = issues.filter(
    (i) => i.status === "open" || i.status === "in_progress",
  );
  const criticalOpen = openIssues.filter(
    (i) => i.severity === "critical" || i.severity === "high",
  ).length;

  const root_cause_breakdown: Record<RootCauseCategory, number> = {
    ...EMPTY_RCA,
  };
  for (const issue of issues) {
    if (issue.root_cause_category) {
      root_cause_breakdown[issue.root_cause_category] += 1;
    }
  }

  const riskScores = risks.map((r) => r.score);
  const risk_score =
    riskScores.length > 0
      ? Math.round((avg(riskScores) as number) * 10) / 10
      : 0;
  const risk_level = riskLevelFromScore(risk_score);

  const health = deriveHealth({
    openIssues: openIssues.length,
    criticalOpen,
    complianceRate: procedure_compliance_rate,
    riskScore: risk_score,
  });

  return {
    process_id: processId,
    node_ids: nodeIds,
    procedure_compliance_rate,
    open_issues_count: openIssues.length,
    root_cause_breakdown,
    risk_score,
    risk_level,
    employee_reports_count: employee_reports.length,
    inspection_pass_rate,
    health,
    procedures,
    inspections,
    issues,
    risks,
    employee_reports,
  };
}

export function healthByNodeId(
  db: ProcessModuleDb,
): Record<string, ProcessHealth> {
  const map: Record<string, ProcessHealth> = {};
  for (const n of db.nodes) {
    const a = computeAnalytics(db, n.id);
    map[n.id] = a?.health ?? "neutral";
  }
  return map;
}
