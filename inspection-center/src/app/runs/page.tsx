import Link from "next/link";
import { revalidatePath } from "next/cache";
import { revalidateActionsPaths } from "@/app/actions/cache";
import { revalidateFindingsPaths } from "@/app/findings/cache";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  RunPlanMetricFilter,
  type RunPlanMetricFilterValue,
} from "@/components/runs/RunPlanMetricFilter";
import { RunStatusFilter } from "@/components/runs/RunStatusFilter";
import { RunTypeFilter } from "@/components/runs/RunTypeFilter";
import { RunsTypeTree, type RunListRow } from "@/components/runs/RunsTypeTree";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { isFindingResolved } from "@/lib/actions/action-planning";
import {
  deleteInspectionRun,
  ensureStoreHydrated,
  getRunScore,
  readAnnualPlans,
  readStore,
  runStoreMutation,
} from "@/lib/store";
import { formatPercent } from "@/lib/scoring";
import {
  INSPECTION_TYPE_LABELS,
  INSPECTION_RUN_SAVE_STATUS_OPTIONS,
  RUN_STATUS_LABELS,
  formatInspectedPlaceText,
  type AnnualPlanMetric,
  type AnnualPlanRow,
  type InspectionRun,
  type InspectionRunSaveStatus,
  type InspectionType,
  type RunStatus,
} from "@/lib/types";

const PLAN_METRIC_LABELS: Record<Exclude<AnnualPlanMetric, "regular">, string> = {
  planned: "Төлөвлөгөөт",
  unplanned: "Төлөвлөгөөт бус",
  completed: "Гүйцэтгэл",
  as_needed: "Тухай бүр",
};

const RUN_TYPE_FILTER_OPTIONS: Array<{
  value: InspectionType;
  label: string;
}> = [
  { value: "STATE_INSPECTION", label: INSPECTION_TYPE_LABELS.STATE_INSPECTION },
  { value: "CHECKLIST", label: INSPECTION_TYPE_LABELS.CHECKLIST },
  { value: "NIGHT_INSPECTION", label: INSPECTION_TYPE_LABELS.NIGHT_INSPECTION },
  { value: "JOINT_INSPECTION", label: INSPECTION_TYPE_LABELS.JOINT_INSPECTION },
  {
    value: "DOCUMENT_INSPECTION",
    label: INSPECTION_TYPE_LABELS.DOCUMENT_INSPECTION,
  },
  {
    value: "UNPLANNED_INSPECTION",
    label: INSPECTION_TYPE_LABELS.UNPLANNED_INSPECTION,
  },
];

const RUN_TYPE_VALUES = new Set<InspectionType>(
  RUN_TYPE_FILTER_OPTIONS.map((option) => option.value),
);

const RUN_STATUS_FILTER_OPTIONS = INSPECTION_RUN_SAVE_STATUS_OPTIONS;

const RUN_STATUS_VALUES = new Set<InspectionRunSaveStatus>(
  RUN_STATUS_FILTER_OPTIONS.map((option) => option.value),
);

const RUN_PLAN_METRIC_FILTER_OPTIONS: Array<{
  value: RunPlanMetricFilterValue;
  label: string;
}> = [
  { value: "planned", label: PLAN_METRIC_LABELS.planned },
  { value: "unplanned", label: PLAN_METRIC_LABELS.unplanned },
  { value: "completed", label: PLAN_METRIC_LABELS.completed },
];

const RUN_PLAN_METRIC_VALUES = new Set<RunPlanMetricFilterValue>(
  RUN_PLAN_METRIC_FILTER_OPTIONS.map((option) => option.value),
);

function matchesStatusFilter(
  runStatus: RunStatus,
  selectedStatus: InspectionRunSaveStatus | "all",
) {
  if (selectedStatus === "all") return true;
  if (selectedStatus === "completed") {
    return runStatus === "completed" || runStatus === "submitted";
  }
  return runStatus === selectedStatus;
}

function normalizeMetric(metric: AnnualPlanMetric): Exclude<AnnualPlanMetric, "regular"> {
  return metric === "regular" ? "as_needed" : metric;
}

function matchesPlanRow(run: InspectionRun, row: AnnualPlanRow) {
  if (run.planId) return run.planId === row.id;
  if (row.templateId && run.templateId === row.templateId) {
    if (run.inspectionType !== row.inspectionType) return false;
    if (run.planMetric && normalizeMetric(run.planMetric) !== normalizeMetric(row.metric)) {
      return false;
    }
    return true;
  }
  if (run.inspectionType !== row.inspectionType) return false;
  if (run.planMetric && normalizeMetric(run.planMetric) !== normalizeMetric(row.metric)) {
    return false;
  }
  const planName = row.checklistName.toLocaleLowerCase();
  const runTitle = run.title.toLocaleLowerCase();
  return Boolean(
    planName &&
      (runTitle.includes(planName) || planName.includes(runTitle)),
  );
}

function planMetricForRun(run: InspectionRun, annualPlans: AnnualPlanRow[]) {
  if (run.planMetric) return normalizeMetric(run.planMetric);
  const planRow = annualPlans.find((row) => matchesPlanRow(run, row));
  if (planRow) return normalizeMetric(planRow.metric);
  return run.inspectionType === "UNPLANNED_INSPECTION" ? "unplanned" : "planned";
}

/** True once user confirmed via Шинэ шалгалт (non-draft) or Асуултын оноо → Хадгалах. */
function isListedExecutionRun(
  run: InspectionRun,
  answers: { runId: string; answeredAt: string }[],
) {
  if (run.status !== "draft") return true;
  return answers.some(
    (answer) => answer.runId === run.id && Boolean(answer.answeredAt),
  );
}

export const dynamic = "force-dynamic";

async function removeInspectionRun(formData: FormData) {
  "use server";
  const { assertInspectionWriteAccess } = await import("@/lib/access/scope");
  await assertInspectionWriteAccess();
  await runStoreMutation(() =>
    deleteInspectionRun(String(formData.get("id") || "")),
  );
  revalidatePath("/runs");
  revalidatePath("/plans");
  revalidateActionsPaths();
  revalidateFindingsPaths();
  revalidatePath("/dashboard");
}

export default async function RunsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string; metric?: string }>;
}) {
  const { getInspectionScope, isInspectionReadOnly } = await import(
    "@/lib/access/scope"
  );
  await ensureStoreHydrated();
  const scope = await getInspectionScope();
  const readOnly = isInspectionReadOnly(scope);
  const { resolveUnitTemplateIds } = await import("@/lib/access/scope");
  const unitTemplateIds = readOnly ? await resolveUnitTemplateIds(scope) : null;
  // Skip ensureDraftRunsForAnnualPlans on GET — remote flush caused production timeouts.
  const sp = await searchParams;
  const data = readStore();
  const annualPlans = readAnnualPlans();
  const selectedType = RUN_TYPE_VALUES.has(sp.type as InspectionType)
    ? (sp.type as InspectionType)
    : "all";
  const selectedStatus = RUN_STATUS_VALUES.has(
    sp.status as InspectionRunSaveStatus,
  )
    ? (sp.status as InspectionRunSaveStatus)
    : "all";
  const selectedMetric = RUN_PLAN_METRIC_VALUES.has(
    sp.metric as RunPlanMetricFilterValue,
  )
    ? (sp.metric as RunPlanMetricFilterValue)
    : "all";
  const findingsByRunId = data.findings.reduce<
    Map<string, typeof data.findings>>((map, finding) => {
    const runFindings = map.get(finding.runId) ?? [];
    runFindings.push(finding);
    map.set(finding.runId, runFindings);
    return map;
  }, new Map());
  const archivedRunIds = new Set(
    Array.from(findingsByRunId.entries())
      .filter(
        ([, findings]) =>
          findings.length > 0 &&
          findings.every((finding) => isFindingResolved(finding.status)),
      )
      .map(([runId]) => runId),
  );
  const planIds = new Set(annualPlans.map((plan) => plan.id));
  const runs = [...data.runs]
    .filter(
      (run) =>
        !archivedRunIds.has(run.id) ||
        Boolean(run.planId && planIds.has(run.planId)),
    )
    // Exclude Төрлөөр/auto placeholders until Хуудсаар → Гүйцэтгэл/Шинэ шалгалт
    // and confirmation (non-draft create, or Асуултын оноо → Хадгалах).
    .filter((run) => isListedExecutionRun(run, data.answers))
    .filter((run) => {
      if (!unitTemplateIds) return true;
      if (run.templateId && unitTemplateIds.has(run.templateId)) return true;
      if (!run.templateId) {
        const plan = annualPlans.find((p) => p.id === run.planId);
        if (plan?.templateId && unitTemplateIds.has(plan.templateId)) {
          return true;
        }
      }
      return false;
    })
    .filter(
      (run) => selectedType === "all" || run.inspectionType === selectedType,
    )
    .filter((run) => matchesStatusFilter(run.status, selectedStatus))
    .filter((run) => {
      if (selectedMetric === "all") return true;
      return planMetricForRun(run, annualPlans) === selectedMetric;
    })
    .sort((a, b) => b.inspectionDate.localeCompare(a.inspectionDate));

  const rows: RunListRow[] = runs.map((run) => {
    const score = getRunScore(data, run.id);
    return {
      id: run.id,
      title: run.title,
      inspectionType: run.inspectionType,
      inspectionTypeLabel: INSPECTION_TYPE_LABELS[run.inspectionType],
      categoryLabel: PLAN_METRIC_LABELS[planMetricForRun(run, annualPlans)],
      inspectedPlace: formatInspectedPlaceText(run.performers),
      inspectionDate: run.inspectionDate,
      dueDate: run.dueDate || "—",
      completedDate: run.completedDate || "—",
      complianceLabel: score ? formatPercent(score.compliancePercent) : "—",
      riskLabel: score
        ? `${formatPercent(score.riskPercent)} · ${score.riskLevel}`
        : "—",
      riskTone: score
        ? score.riskLevel === "Их"
          ? "danger"
          : score.riskLevel === "Дунд"
            ? "warn"
            : "ok"
        : null,
      statusLabel: RUN_STATUS_LABELS[run.status],
    };
  });

  return (
    <div>
      <PageHeader
        title="Шалгалтын гүйцэтгэл"
        subtitle={
          readOnly
            ? "Хяналт шалгалтын гүйцэтгэл · зөвхөн үзэх эрх"
            : "Хяналт шалгалтын гүйцэтгэл"
        }
        actions={
          <>
            <ExportButtons tableId="runs-table" filename="inspection-runs" />
            {!readOnly ? (
              <Link href="/runs/new" className="btn btn-primary">
                Шинэ шалгалт
              </Link>
            ) : null}
          </>
        }
      />

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3 rounded-md border border-[var(--border)] bg-white p-3">
        <div className="flex flex-wrap items-end gap-3">
          <RunTypeFilter
            options={RUN_TYPE_FILTER_OPTIONS}
            selectedType={selectedType}
          />
          <RunPlanMetricFilter
            options={RUN_PLAN_METRIC_FILTER_OPTIONS}
            selectedMetric={selectedMetric}
          />
          <RunStatusFilter
            options={RUN_STATUS_FILTER_OPTIONS}
            selectedStatus={selectedStatus}
          />
        </div>
        <div className="text-sm text-[var(--muted)]">
          {runs.length} шалгалт
        </div>
      </div>

      <RunsTypeTree
        rows={rows}
        onDelete={readOnly ? undefined : removeInspectionRun}
      />
    </div>
  );
}
