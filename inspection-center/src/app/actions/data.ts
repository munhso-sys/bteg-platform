import { ensureStoreHydrated } from "@/lib/store";
import { readScopedStore } from "@/lib/access/scope";
import {
  actionDisplayStatus,
  dueDateSummary,
  isFindingEffectivelyResolved,
  recommendedActionText,
  riskScoreForFinding,
} from "@/lib/actions/action-planning";
import { INSPECTION_TYPE_LABELS } from "@/lib/types";
import type { CorrectiveActionRow } from "@/components/actions/types";
import type {
  CorrectiveAction,
  InspectionCenterData,
  InspectionFinding,
  InspectionRun,
} from "@/lib/types";

export type ActionsPageMode = "open" | "resolved" | "overview" | "all";

function isFollowUpRun(run: InspectionRun | undefined) {
  return run?.planMetric === "completed";
}

function buildRow(input: {
  finding: InspectionFinding;
  action: CorrectiveAction | undefined;
  run: InspectionRun | undefined;
  questionText: string;
  sectionTitle: string;
  checklistTitle: string;
  today: string;
  data: InspectionCenterData;
}): CorrectiveActionRow {
  const { finding, action, run, questionText, sectionTitle, checklistTitle, today, data } =
    input;
  const risk = riskScoreForFinding(data, finding, run);
  const due = dueDateSummary(action, today);

  return {
    findingId: finding.id,
    actionId: action?.id ?? null,
    findingTitle: finding.title,
    findingDescription: finding.description || "",
    findingSourceText: finding.sourceText || "",
    findingStatus: finding.status,
    questionText,
    runId: finding.runId,
    runTitle: run?.title ?? finding.runId.slice(0, 8),
    checklistTitle,
    sectionTitle,
    inspectionTypeLabel: run ? INSPECTION_TYPE_LABELS[run.inspectionType] : "-",
    inspectionDate: run?.inspectionDate ?? "",
    runDueDate: run?.dueDate ?? "",
    runCompletedDate: run?.completedDate ?? "",
    inspectedByOrg: run?.inspectedByOrg ?? "",
    performers: (run?.performers ?? []).filter(
      (row) => row.name.trim() || row.position.trim(),
    ),
    targetOrgUnitId: finding.targetOrgUnitId || run?.targetOrgUnitId || "",
    targetDepartmentId:
      finding.targetDepartmentId || run?.targetDepartmentId || "",
    severity: finding.severity,
    riskLabel: risk.label,
    riskScore: risk.score,
    riskExplanation: risk.explanation,
    actionText: recommendedActionText(finding, action),
    responsibleEmployeeId: action?.responsibleEmployeeId ?? "",
    responsibleJobPositionId: action?.responsibleJobPositionId ?? "",
    responsibleOrgUnitId: action?.responsibleOrgUnitId ?? "",
    startDate: action?.startDate ?? new Date().toISOString().slice(0, 10),
    dueDate: action?.dueDate ?? "",
    completedDate: action?.completedDate ?? "",
    progressPercent: action?.progressPercent ?? 0,
    actionStatus: actionDisplayStatus(action, today),
    managerComment: action?.managerComment ?? "",
    dueLabel: due.label,
    dueTone: due.tone,
  };
}

export async function loadActionsPageData(mode: ActionsPageMode = "all") {
  await ensureStoreHydrated();
  // Never mutate store on GET — joint finding expansion runs on save only.
  const { data } = await readScopedStore();
  const today = new Date().toISOString().slice(0, 10);
  const needOpen = mode === "open" || mode === "overview" || mode === "all";
  const needResolved = mode === "resolved" || mode === "all";
  const actionByFindingId = new Map(
    data.actions.map((action) => [action.findingId, action]),
  );
  const activeFindings = data.findings.filter(
    (finding) =>
      !isFollowUpRun(data.runs.find((run) => run.id === finding.runId)),
  );

  const openFindings = needOpen
    ? activeFindings.filter(
        (finding) =>
          !isFindingEffectivelyResolved(
            finding,
            actionByFindingId.get(finding.id),
          ),
      )
    : [];
  const resolvedFindings = needResolved
    ? activeFindings.filter((finding) =>
        isFindingEffectivelyResolved(
          finding,
          actionByFindingId.get(finding.id),
        ),
      )
    : [];
  const relevantRunIds = new Set(
    [...openFindings, ...resolvedFindings].map((f) => f.runId),
  );
  const runMap = new Map(
    data.runs
      .filter((run) => relevantRunIds.has(run.id))
      .map((run) => [run.id, run]),
  );
  const actionMap = new Map(
    data.actions.map((action) => [action.findingId, action]),
  );
  const answerMap = new Map(data.answers.map((answer) => [answer.id, answer]));
  const questionMap = new Map(
    data.questions.map((question) => [question.id, question]),
  );
  const sectionMap = new Map(
    data.sections.map((section) => [section.id, section]),
  );
  const templateMap = new Map(
    data.templates.map((template) => [template.id, template]),
  );

  function resolveQuestionMeta(finding: InspectionFinding) {
    const answer = finding.answerId ? answerMap.get(finding.answerId) : undefined;
    const question = answer
      ? questionMap.get(answer.templateQuestionId)
      : undefined;
    const section = question?.sectionId
      ? sectionMap.get(question.sectionId)
      : undefined;
    const run = runMap.get(finding.runId);
    const template = run?.templateId
      ? templateMap.get(run.templateId)
      : question
        ? templateMap.get(question.templateId)
        : undefined;
    const checklistTitle = template
      ? [template.code, template.title].filter(Boolean).join(" — ")
      : (run?.title ?? "ХШ хуудас");
    const unitSuffix = finding.jointUnitKey
      ? finding.targetOrgUnitId || finding.jointUnitKey
      : "";
    return {
      question,
      sectionTitle: section
        ? [section.sectionNo, section.title].filter(Boolean).join(". ")
        : "",
      checklistTitle,
      questionText: [
        question?.questionText || finding.description || finding.title,
        unitSuffix ? `(${unitSuffix})` : "",
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  const rows = openFindings
    .map((finding) => {
      const meta = resolveQuestionMeta(finding);
      return buildRow({
        finding,
        action: actionMap.get(finding.id),
        run: runMap.get(finding.runId),
        questionText: meta.questionText,
        sectionTitle: meta.sectionTitle,
        checklistTitle: meta.checklistTitle,
        today,
        data,
      });
    })
    .sort(
      (a, b) =>
        b.riskScore - a.riskScore ||
        (a.dueDate || "9999").localeCompare(b.dueDate || "9999"),
    );

  const resolvedRows = resolvedFindings
    .map((finding) => {
      const meta = resolveQuestionMeta(finding);
      return buildRow({
        finding,
        action: actionMap.get(finding.id),
        run: runMap.get(finding.runId),
        questionText: meta.questionText,
        sectionTitle: meta.sectionTitle,
        checklistTitle: meta.checklistTitle,
        today,
        data,
      });
    })
    .sort((a, b) =>
      (b.completedDate || b.dueDate).localeCompare(a.completedDate || a.dueDate),
    );

  const severitySource =
    mode === "resolved" ? resolvedFindings : openFindings;
  const severityOptions = Array.from(
    new Set(severitySource.map((finding) => finding.severity)),
  ).sort();
  const statusOptions = Array.from(
    new Set(["no_action", "overdue", ...data.actions.map((action) => action.status)]),
  );
  const typeOptions = Array.from(
    new Set(
      severitySource
        .map((finding) => runMap.get(finding.runId))
        .filter((run): run is InspectionRun => Boolean(run))
        .map((run) => INSPECTION_TYPE_LABELS[run.inspectionType]),
    ),
  )
    .sort()
    .map((label) => ({ value: label, label }));

  return {
    data,
    rows,
    resolvedRows,
    severityOptions,
    statusOptions,
    typeOptions,
  };
}
