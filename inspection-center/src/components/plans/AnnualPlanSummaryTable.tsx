"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PlayCircle } from "lucide-react";
import { StatusBadge, TableScroll } from "@/components/ui/primitives";
import { formatPercent } from "@/lib/scoring";
import type {
  AnnualPlanMetric,
  AnnualPlanRow,
  InspectionRun,
  InspectionScoreSnapshot,
} from "@/lib/types";
import { RUN_STATUS_LABELS, normalizeRunExecutionStatus } from "@/lib/types";

type SummaryMetric = Exclude<AnnualPlanMetric, "regular">;
type ExecutionStatus = "completed" | "in_progress" | "planned" | "cancelled";

const SUMMARY_METRICS: Array<{ value: SummaryMetric; label: string }> = [
  { value: "planned", label: "Төлөвлөгөөт" },
  { value: "unplanned", label: "Төлөвлөгөөт бус" },
  { value: "completed", label: "Гүйцэтгэл" },
];

const STATUS_OPTIONS: Array<{ value: "all" | ExecutionStatus; label: string }> =
  [
    { value: "all", label: "Бүгд" },
    { value: "planned", label: RUN_STATUS_LABELS.draft },
    { value: "in_progress", label: RUN_STATUS_LABELS.in_progress },
    { value: "completed", label: RUN_STATUS_LABELS.completed },
    { value: "cancelled", label: RUN_STATUS_LABELS.cancelled },
  ];

const STATUS_LABELS: Record<ExecutionStatus, string> = {
  completed: RUN_STATUS_LABELS.completed,
  in_progress: RUN_STATUS_LABELS.in_progress,
  planned: RUN_STATUS_LABELS.draft,
  cancelled: RUN_STATUS_LABELS.cancelled,
};

const STATUS_TONES: Record<
  ExecutionStatus,
  "ok" | "warn" | "brand" | "danger" | "neutral"
> = {
  completed: "ok",
  in_progress: "warn",
  planned: "brand",
  cancelled: "neutral",
};

function normalizeMetric(metric: AnnualPlanMetric): SummaryMetric {
  return metric === "regular" ? "as_needed" : metric;
}

function runMetric(run: InspectionRun): SummaryMetric {
  return normalizeMetric(run.planMetric ?? "planned");
}

function totalCount(row: AnnualPlanRow) {
  return Object.values(row.months).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0,
  );
}

function firstPlannedDate(row: AnnualPlanRow) {
  return Object.values(row.detailDates).flat().sort()[0] ?? "";
}

function plannedStatusFor(row: AnnualPlanRow, today: string): ExecutionStatus {
  if (row.metric === "completed") return "completed";
  const date = firstPlannedDate(row);
  if (date && date <= today) {
    return "in_progress";
  }
  return "planned";
}

function matchesPlanRow(run: InspectionRun, row: AnnualPlanRow) {
  if (run.planId) return run.planId === row.id;
  if (row.templateId && run.templateId === row.templateId) {
    if (run.inspectionType !== row.inspectionType) return false;
    if (run.planMetric && runMetric(run) !== normalizeMetric(row.metric)) {
      return false;
    }
    return true;
  }
  if (run.inspectionType !== row.inspectionType) return false;
  if (run.planMetric && runMetric(run) !== normalizeMetric(row.metric)) return false;
  const planName = row.checklistName.toLocaleLowerCase();
  const runTitle = run.title.toLocaleLowerCase();
  return Boolean(
    planName &&
      (runTitle.includes(planName) || planName.includes(runTitle)),
  );
}

function matchedRunsForRow(row: AnnualPlanRow, runs: InspectionRun[]) {
  return runs.filter((run) => matchesPlanRow(run, row));
}

function primaryRunForRow(row: AnnualPlanRow, runs: InspectionRun[]) {
  const matched = matchedRunsForRow(row, runs);
  if (matched.length === 0) return null;
  const linked = matched.filter((run) => run.planId === row.id);
  const pool = linked.length > 0 ? linked : matched;
  return pool.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
}

function unmatchedRunsForMetric(
  rows: AnnualPlanRow[],
  runs: InspectionRun[],
  metric: SummaryMetric,
) {
  return runs.filter(
    (run) =>
      runMetric(run) === metric &&
      !rows.some((row) => matchesPlanRow(run, row)),
  );
}

function runStatusFor(run: InspectionRun): ExecutionStatus {
  return normalizeRunExecutionStatus(run.status);
}

function statusCountsForRows(
  rows: AnnualPlanRow[],
  runs: InspectionRun[],
  today: string,
  metric?: SummaryMetric,
) {
  const totals = rows.reduce(
    (totals, row) => {
      const matchedRuns = matchedRunsForRow(row, runs);
      if (matchedRuns.length === 0) {
        const planned = plannedStatusFor(row, today);
        if (planned === "in_progress") totals.inProgress += totalCount(row);
        if (planned === "completed") totals.completed += totalCount(row);
        return totals;
      }

      for (const run of matchedRuns) {
        const status = runStatusFor(run);
        if (status === "completed") totals.completed += 1;
        else if (status === "in_progress") totals.inProgress += 1;
      }
      return totals;
    },
    { inProgress: 0, completed: 0 },
  );
  if (metric) {
    for (const run of unmatchedRunsForMetric(rows, runs, metric)) {
      const status = runStatusFor(run);
      if (status === "completed") totals.completed += 1;
      else if (status === "in_progress") totals.inProgress += 1;
    }
  }
  return totals;
}

function statusFor(
  row: AnnualPlanRow,
  runs: InspectionRun[],
  today: string,
): ExecutionStatus {
  const primary = primaryRunForRow(row, runs);
  if (primary) return runStatusFor(primary);
  return plannedStatusFor(row, today);
}

function resultFor(
  row: AnnualPlanRow,
  runs: InspectionRun[],
  scores: InspectionScoreSnapshot[],
) {
  const completedRuns = matchedRunsForRow(row, runs).filter(
    (run) => runStatusFor(run) === "completed",
  );
  if (completedRuns.length === 0) return "—";
  const scoreByRunId = new Map(scores.map((score) => [score.runId, score]));
  const score = completedRuns
    .map((run) => scoreByRunId.get(run.id)?.compliancePercent)
    .filter((value): value is number => typeof value === "number")[0];
  return score == null
    ? `${completedRuns.length} ХШ бүртгэгдсэн`
    : `${completedRuns.length} ХШ · ${formatPercent(score)}`;
}

function averageScoreForRows(
  rows: AnnualPlanRow[],
  runs: InspectionRun[],
  scores: InspectionScoreSnapshot[],
  metric?: SummaryMetric,
) {
  const scoreByRunId = new Map(scores.map((score) => [score.runId, score]));
  const rowScores = rows.flatMap((row) =>
    matchedRunsForRow(row, runs)
      .filter((run) => runStatusFor(run) === "completed")
      .map((run) => scoreByRunId.get(run.id)?.compliancePercent)
      .filter((value): value is number => typeof value === "number"),
  );
  const unmatchedScores = metric
    ? unmatchedRunsForMetric(rows, runs, metric)
        .filter((run) => runStatusFor(run) === "completed")
        .map((run) => scoreByRunId.get(run.id)?.compliancePercent)
        .filter((value): value is number => typeof value === "number")
    : [];
  const matchedScores = [...rowScores, ...unmatchedScores];
  if (matchedScores.length === 0) return null;
  return (
    matchedScores.reduce((sum, value) => sum + value, 0) /
    matchedScores.length
  );
}

function resultForRun(
  run: InspectionRun,
  scores: InspectionScoreSnapshot[],
) {
  if (runStatusFor(run) !== "completed") return "—";
  const score = scores.find((item) => item.runId === run.id);
  return score
    ? `1 ХШ · ${formatPercent(score.compliancePercent)}`
    : "1 ХШ бүртгэгдсэн";
}

function latestMatchedRun(row: AnnualPlanRow, runs: InspectionRun[]) {
  return matchedRunsForRow(row, runs).sort((a, b) =>
    b.inspectionDate.localeCompare(a.inspectionDate),
  )[0];
}

export function AnnualPlanSummaryTable({
  rows,
  runs,
  scores,
  today,
  readOnly = false,
}: {
  rows: AnnualPlanRow[];
  runs: InspectionRun[];
  answers: unknown[];
  scores: InspectionScoreSnapshot[];
  /** Server-provided YYYY-MM-DD to avoid SSR/client date hydration mismatch */
  today: string;
  readOnly?: boolean;
}) {
  const [selectedMetric, setSelectedMetric] =
    useState<SummaryMetric>("planned");
  const [statusFilter, setStatusFilter] = useState<"all" | ExecutionStatus>(
    "all",
  );

  const summary = useMemo(
    () =>
      SUMMARY_METRICS.map((item) => {
        const metricRows = rows.filter(
          (row) => normalizeMetric(row.metric) === item.value,
        );
        const unmatchedRuns = unmatchedRunsForMetric(rows, runs, item.value);
        const statusCounts = statusCountsForRows(
          metricRows,
          runs,
          today,
          item.value,
        );
        return {
          metric: item.value,
          label: item.label,
          count:
            metricRows.reduce((sum, row) => sum + totalCount(row), 0) +
            unmatchedRuns.length,
          inProgress: statusCounts.inProgress,
          completed: statusCounts.completed,
          averageScore: averageScoreForRows(
            metricRows,
            runs,
            scores,
            item.value,
          ),
        };
      }),
    [rows, runs, scores, today],
  );

  const details = useMemo(
    () =>
      [
        ...rows
        .filter((row) => normalizeMetric(row.metric) === selectedMetric)
        .map((row) => {
          const run = primaryRunForRow(row, runs) ?? latestMatchedRun(row, runs);
          return {
            ...row,
            plannedDate: firstPlannedDate(row),
            count: totalCount(row),
            executionStatus: statusFor(row, runs, today),
            result: resultFor(row, runs, scores),
            runHref: run
              ? `/runs/${run.id}`
              : readOnly
                ? "#"
                : `/runs/new?annualPlanId=${encodeURIComponent(row.id)}`,
          };
        }),
        ...unmatchedRunsForMetric(rows, runs, selectedMetric).map((run) => ({
          id: `run-${run.id}`,
          checklistName: run.title,
          plannedDate: run.inspectionDate,
          count: 1,
          executionStatus: runStatusFor(run),
          result: resultForRun(run, scores),
          runHref: `/runs/${run.id}`,
        })),
      ]
        .filter(
          (row) => statusFilter === "all" || row.executionStatus === statusFilter,
        )
        .sort((a, b) =>
          `${a.plannedDate || "9999-99-99"}-${a.checklistName}`.localeCompare(
            `${b.plannedDate || "9999-99-99"}-${b.checklistName}`,
          ),
        ),
    [rows, runs, scores, selectedMetric, statusFilter, today, readOnly],
  );

  const selectedLabel =
    SUMMARY_METRICS.find((item) => item.value === selectedMetric)?.label ??
    selectedMetric;

  return (
    <div className="min-w-0 space-y-4">
      <TableScroll size="sm" maxHeightClass="max-h-[14rem] sm:max-h-[18rem]">
        <table id="annual-plan-table">
          <thead>
            <tr>
              <th>Үзүүлэлт</th>
              <th>Нийт ХШ-ийн тоо, ш</th>
              <th>Хийгдэж байгаа</th>
              <th>Хийгдсэн</th>
              <th>Үнэлгээний дундаж</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((item) => (
              <tr key={item.metric}>
                <td>
                  <button
                    className={`text-left font-semibold underline-offset-2 hover:underline ${
                      selectedMetric === item.metric
                        ? "text-[var(--brand)]"
                        : "text-[var(--fg)]"
                    }`}
                    type="button"
                    onClick={() => {
                      setSelectedMetric(item.metric);
                      setStatusFilter("all");
                    }}>
                    {item.label}
                  </button>
                </td>
                <td className="font-semibold tabular-nums">{item.count}</td>
                <td className="tabular-nums">{item.inProgress}</td>
                <td className="tabular-nums">{item.completed}</td>
                <td className="tabular-nums">
                  {item.averageScore == null
                    ? "—"
                    : formatPercent(item.averageScore)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>

      <div className="min-w-0 rounded-md border border-[var(--border)]">
        <div className="flex flex-col gap-2 border-b border-[var(--border)] bg-slate-50 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-[var(--fg)]">
              {selectedLabel} дэлгэрэнгүй
            </div>
            <div className="text-xs text-[var(--muted)]">
              ХШ-ын хуудсын нэрээр, төлөвлөсөн хугацаагаар жагсаав
            </div>
          </div>
          <select
            className="select w-full sm:max-w-48 sm:w-auto"
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as "all" | ExecutionStatus)
            }>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <TableScroll
          size="md"
          maxHeightClass="max-h-[22rem] sm:max-h-[32rem]"
          className="rounded-none border-0 border-t"
        >
          <table>
            <thead>
              <tr>
                <th className="col-text-primary">ХШ-ын хуудас</th>
                <th className="col-narrow">Төлөвлөсөн хугацаа</th>
                <th className="col-narrow-sm">Тоо, ш</th>
                <th className="col-narrow">Гүйцэтгэл</th>
                <th className="w-10"></th>
                <th className="col-text">Гарсан үр дүн</th>
              </tr>
            </thead>
            <tbody>
              {details.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-sm text-[var(--muted)]">
                    Энэ үзүүлэлтэд тохирох мөр алга.
                  </td>
                </tr>
              ) : (
                details.map((row) => (
                  <tr key={row.id}>
                    <td className="col-text-primary" title={row.checklistName}>
                      <span className="cell-ellipsis font-medium">
                        {row.checklistName}
                      </span>
                    </td>
                    <td className="col-narrow tabular-nums">
                      {row.plannedDate || "—"}
                    </td>
                    <td className="col-narrow-sm tabular-nums">{row.count}</td>
                    <td className="col-narrow">
                      <StatusBadge tone={STATUS_TONES[row.executionStatus]}>
                        {STATUS_LABELS[row.executionStatus]}
                      </StatusBadge>
                    </td>
                    <td className="w-10">
                      <Link
                        className="btn btn-primary p-1.5"
                        href={row.runHref}
                        title="Гүйцэтгэл"
                        aria-label="Гүйцэтгэл"
                      >
                        <PlayCircle aria-hidden="true" className="h-4 w-4" />
                      </Link>
                    </td>
                    <td className="col-text text-sm text-[var(--muted)]" title={row.result}>
                      <span className="cell-ellipsis">{row.result}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableScroll>
      </div>
    </div>
  );
}
