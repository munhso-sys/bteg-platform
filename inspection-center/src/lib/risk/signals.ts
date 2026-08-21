import {
  actionDisplayStatus,
  isActionClosed,
  isFindingResolved,
  recommendedActionText,
  riskScoreForFinding,
} from "@/lib/actions/action-planning";
import { ensureStoreHydrated, readStore } from "@/lib/store";
import {
  FINDING_TYPE_LABELS,
  INSPECTION_TYPE_LABELS,
  SEVERITY_LABELS,
} from "@/lib/types";

export type InspectionRiskSignal = {
  id: string;
  source: "inspection";
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

const IMPACT: Record<string, number> = {
  low: 2,
  medium: 3,
  high: 4,
  critical: 5,
};

function workStatus(status: string) {
  if (status === "overdue") return "Хугацаа хэтэрсэн";
  if (status === "in_progress") return "Хийгдэж байгаа";
  if (status === "assigned") return "Хуваарилсан";
  if (status === "submitted") return "Илгээсэн";
  if (status === "verified" || status === "closed") return "Хаагдсан";
  if (status === "no_action") return "Төлөвлөгөөгүй";
  return status;
}

export async function inspectionRiskSignals(): Promise<InspectionRiskSignal[]> {
  await ensureStoreHydrated();
  const data = readStore();
  const today = new Date().toISOString().slice(0, 10);
  const actionByFinding = new Map(data.actions.map((a) => [a.findingId, a]));
  const runById = new Map(data.runs.map((r) => [r.id, r]));
  const questionById = new Map(data.questions.map((q) => [q.id, q]));
  const answerById = new Map(data.answers.map((a) => [a.id, a]));

  const items: InspectionRiskSignal[] = [];

  for (const finding of data.findings) {
    const action = actionByFinding.get(finding.id);
    const closed = isFindingResolved(finding.status) && isActionClosed(action);
    if (closed) continue;

    const run = runById.get(finding.runId);
    const answer = finding.answerId ? answerById.get(finding.answerId) : null;
    const question = answer
      ? questionById.get(answer.templateQuestionId)
      : null;
    const display = actionDisplayStatus(action, today);
    const risk = riskScoreForFinding(data, finding, run);
    let status: InspectionRiskSignal["status"] = "open";
    if (display === "overdue") status = "overdue";
    else if (display === "in_progress" || display === "submitted") {
      status = "in_progress";
    } else if (display === "verified" || display === "closed") {
      status = "mitigated";
    }

    items.push({
      id: `insp-${finding.id}`,
      source: "inspection",
      sourceLabel: "Хяналт шалгалт",
      title: finding.title || question?.questionText || "Шалгалтын зөрчил",
      description: [
        FINDING_TYPE_LABELS[finding.findingType],
        SEVERITY_LABELS[finding.severity],
        run ? INSPECTION_TYPE_LABELS[run.inspectionType] : null,
        finding.description || question?.questionText || finding.sourceText,
      ]
        .filter(Boolean)
        .join(" · "),
      unit: run?.inspectedByOrg || "—",
      owner: run?.performers?.map((p) => p.name).filter(Boolean).join(", ") || "—",
      severity: finding.severity,
      score: risk.score,
      status,
      likelihood: IMPACT[finding.severity] ?? 3,
      impact: IMPACT[finding.severity] ?? 3,
      mitigation: {
        summary: recommendedActionText(finding, action),
        progressPercent: action?.progressPercent ?? 0,
        dueDate: action?.dueDate ?? run?.dueDate ?? null,
        workStatus: workStatus(display),
      },
      href: run ? `/runs/${run.id}` : "/findings",
      updatedAt: finding.updatedAt || finding.createdAt,
    });
  }

  items.sort((a, b) => b.score - a.score || b.updatedAt.localeCompare(a.updatedAt));
  return items.slice(0, 80);
}
