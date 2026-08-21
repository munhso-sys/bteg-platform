import { loadAppDataPayload } from "@/lib/risk/store-payload";
import type { RiskSignal, RiskSeverity } from "@/lib/risk/types";

type Finding = {
  id: string;
  runId: string;
  title?: string;
  description?: string;
  sourceText?: string;
  severity?: RiskSeverity;
  status?: string;
  findingType?: string;
  answerId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type Action = {
  findingId: string;
  status?: string;
  progressPercent?: number;
  dueDate?: string | null;
};

type Run = {
  id: string;
  inspectedByOrg?: string;
  dueDate?: string | null;
  performers?: Array<{ name?: string }>;
  inspectionType?: string;
};

type InspectionStore = {
  findings?: Finding[];
  actions?: Action[];
  runs?: Run[];
};

const IMPACT: Record<string, number> = {
  low: 2,
  medium: 3,
  high: 4,
  critical: 5,
};

function isResolved(status?: string) {
  return status === "resolved" || status === "closed" || status === "verified";
}

function isActionClosed(status?: string) {
  return status === "closed" || status === "verified" || status === "no_action";
}

function scoreFor(severity: RiskSeverity) {
  if (severity === "critical") return 90;
  if (severity === "high") return 60;
  if (severity === "medium") return 40;
  return 20;
}

export async function inspectionSignalsFromStore(): Promise<{
  items: RiskSignal[];
  error?: string;
}> {
  const store = await loadAppDataPayload<InspectionStore>(
    "inspection_center_store",
  );
  if (!store) {
    return { items: [], error: "inspection_center_store олдсонгүй" };
  }

  const findings = Array.isArray(store.findings) ? store.findings : [];
  const actions = Array.isArray(store.actions) ? store.actions : [];
  const runs = Array.isArray(store.runs) ? store.runs : [];
  const actionByFinding = new Map(actions.map((a) => [a.findingId, a]));
  const runById = new Map(runs.map((r) => [r.id, r]));
  const today = new Date().toISOString().slice(0, 10);

  const items: RiskSignal[] = [];
  for (const finding of findings) {
    const action = actionByFinding.get(finding.id);
    if (isResolved(finding.status) && isActionClosed(action?.status)) continue;

    const severity = (finding.severity ?? "medium") as RiskSeverity;
    const run = runById.get(finding.runId);
    const due = action?.dueDate ?? run?.dueDate ?? null;
    let status: RiskSignal["status"] = "open";
    if (due && due < today && !isActionClosed(action?.status)) status = "overdue";
    else if (
      action?.status === "in_progress" ||
      action?.status === "submitted" ||
      (action?.progressPercent ?? 0) > 0
    ) {
      status = "in_progress";
    } else if (isActionClosed(action?.status)) {
      status = "mitigated";
    }

    items.push({
      id: `insp-${finding.id}`,
      source: "inspection",
      sourceLabel: "Хяналт шалгалт",
      title: finding.title || finding.sourceText || "Шалгалтын зөрчил",
      description: [
        finding.findingType,
        severity,
        run?.inspectionType,
        finding.description || finding.sourceText,
      ]
        .filter(Boolean)
        .join(" · "),
      unit: run?.inspectedByOrg || "—",
      owner:
        run?.performers?.map((p) => p.name).filter(Boolean).join(", ") || "—",
      severity,
      score: scoreFor(severity),
      status,
      likelihood: IMPACT[severity] ?? 3,
      impact: IMPACT[severity] ?? 3,
      mitigation: {
        summary: "Зөрчлийг арилгах",
        progressPercent: action?.progressPercent ?? 0,
        dueDate: due,
        workStatus:
          status === "overdue"
            ? "Хугацаа хэтэрсэн"
            : status === "in_progress"
              ? "Хийгдэж байгаа"
              : "Нээлттэй",
      },
      href: run ? `/runs/${run.id}` : "/findings",
      updatedAt: finding.updatedAt || finding.createdAt || new Date().toISOString(),
    });
  }

  items.sort(
    (a, b) => b.score - a.score || b.updatedAt.localeCompare(a.updatedAt),
  );
  return { items: items.slice(0, 80) };
}
