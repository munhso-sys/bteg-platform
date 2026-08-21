"use client";

import { useMemo, useState } from "react";
import { CircleAlert } from "lucide-react";
import type {
  AnnualPlanRow,
  AnnualPlanTypeTarget,
  InspectionRun,
  InspectionTemplate,
  InspectionType,
} from "@/lib/types";
import {
  emptyAnnualPlanPeriodCounts,
  countChecklistMonthSelections,
  INSPECTION_TYPE_LABELS,
  normalizeChecklistMonths,
} from "@/lib/types";

const GAP_TYPES: InspectionType[] = [
  "NIGHT_INSPECTION",
  "JOINT_INSPECTION",
  "DOCUMENT_INSPECTION",
];

const EXCLUDED_TEMPLATE_CODES = new Set(["JOINT", "NIGHT"]);
const EXCLUDED_TEMPLATE_LABELS = new Set([
  INSPECTION_TYPE_LABELS.NIGHT_INSPECTION,
  INSPECTION_TYPE_LABELS.JOINT_INSPECTION,
  INSPECTION_TYPE_LABELS.DOCUMENT_INSPECTION,
  INSPECTION_TYPE_LABELS.UNPLANNED_INSPECTION,
]);

function isRegularChecklistTemplate(template: InspectionTemplate) {
  if (!template.active) return false;
  if (EXCLUDED_TEMPLATE_CODES.has(template.code)) return false;
  if (EXCLUDED_TEMPLATE_LABELS.has(template.category)) return false;
  if (EXCLUDED_TEMPLATE_LABELS.has(template.title)) return false;
  return true;
}

function matchesTemplatePlan(row: AnnualPlanRow, template: InspectionTemplate) {
  if (row.templateId && row.templateId === template.id) return true;
  const name = row.checklistName.toLocaleLowerCase();
  const code = template.code.toLocaleLowerCase();
  const title = template.title.toLocaleLowerCase();
  if (code && (name.startsWith(`${code} -`) || name.startsWith(`${code}-`))) {
    return true;
  }
  return Boolean(code && name.includes(code) && name.includes(title));
}

function checkedMonthCount(months: boolean[] | undefined) {
  if (!months) return 0;
  return months.filter(Boolean).length;
}

/** Same year basis as execution lists: inspection / completed / created date. */
function runBelongsToYear(run: InspectionRun, year: number) {
  const stamp =
    run.inspectionDate || run.completedDate || run.createdAt || "";
  return stamp.startsWith(String(year));
}

/**
 * Бүртгэл = Шалгалтын гүйцэтгэл дээрх тухайн ХШ төрлийн folder-т
 * орсон, зөвхөн «Хийгдсэн» төлөвтэй шалгалтын тоо (жилээр шүүсэн).
 */
function countRunsInTypeFolder(
  runs: InspectionRun[],
  type: InspectionType,
  year: number,
) {
  return runs.filter(
    (run) =>
      run.inspectionType === type &&
      runBelongsToYear(run, year) &&
      isCompletedRun(run),
  ).length;
}

function isCompletedRun(run: InspectionRun) {
  return run.status === "completed" || run.status === "submitted";
}

function runMatchesTemplate(run: InspectionRun, template: InspectionTemplate) {
  if (run.templateId && run.templateId === template.id) return true;
  const name = run.title.toLocaleLowerCase();
  const code = template.code.toLocaleLowerCase();
  const title = template.title.toLocaleLowerCase();
  if (code && (name.startsWith(`${code} -`) || name.startsWith(`${code}-`))) {
    return true;
  }
  return Boolean(code && name.includes(code) && name.includes(title));
}

export function AnnualPlanCoverageGaps({
  targets,
  plans,
  templates,
  runs,
  defaultYear,
}: {
  targets: AnnualPlanTypeTarget[];
  plans: AnnualPlanRow[];
  templates: InspectionTemplate[];
  runs: InspectionRun[];
  defaultYear: number;
}) {
  const years = useMemo(() => {
    const set = new Set<number>();
    for (const row of targets) set.add(row.year);
    for (const row of plans) set.add(row.year);
    for (const run of runs) {
      const stamp =
        run.inspectionDate || run.completedDate || run.createdAt || "";
      const y = Number(stamp.slice(0, 4));
      if (Number.isFinite(y) && y > 1900) set.add(y);
    }
    set.add(defaultYear);
    return Array.from(set).sort((a, b) => b - a);
  }, [targets, plans, runs, defaultYear]);

  const [year, setYear] = useState(years[0] ?? defaultYear);
  const yearsKey = years.join(",");
  const [yearsKeyEpoch, setYearsKeyEpoch] = useState(yearsKey);
  if (yearsKey !== yearsKeyEpoch) {
    setYearsKeyEpoch(yearsKey);
    if (!years.includes(year)) setYear(years[0] ?? defaultYear);
  }

  const selectedTarget = useMemo(
    () => targets.find((row) => row.year === year) ?? null,
    [targets, year],
  );

  const yearPlans = useMemo(
    () => plans.filter((row) => row.year === year),
    [plans, year],
  );

  const templateById = useMemo(() => {
    const map = new Map<string, InspectionTemplate>();
    for (const template of templates) map.set(template.id, template);
    return map;
  }, [templates]);

  const missingChecklists = useMemo(() => {
    const checklistMonths = normalizeChecklistMonths(
      selectedTarget?.checklistMonths,
    );
    const rows: Array<{
      id: string;
      code: string;
      title: string;
      plannedMonths: number;
      registeredRuns: number;
    }> = [];

    for (const [templateId, months] of Object.entries(checklistMonths)) {
      const plannedMonths = checkedMonthCount(months);
      if (plannedMonths === 0) continue;
      const template =
        templateById.get(templateId) ??
        templates.find((item) => item.id === templateId);
      if (!template || !isRegularChecklistTemplate(template)) {
        if (!template) {
          rows.push({
            id: templateId,
            code: templateId.slice(0, 8),
            title: "Тодорхойгүй ХШ",
            plannedMonths,
            registeredRuns: 0,
          });
        }
        continue;
      }
      const registeredInPlan = yearPlans.some((plan) =>
        matchesTemplatePlan(plan, template),
      );
      if (!registeredInPlan) {
        const registeredRuns = runs.filter(
          (run) =>
            runBelongsToYear(run, year) &&
            isCompletedRun(run) &&
            runMatchesTemplate(run, template),
        ).length;
        rows.push({
          id: template.id,
          code: template.code,
          title: template.title,
          plannedMonths,
          registeredRuns,
        });
      }
    }

    return rows.sort((a, b) =>
      a.code.localeCompare(b.code, undefined, { numeric: true }),
    );
  }, [
    selectedTarget?.checklistMonths,
    templateById,
    templates,
    yearPlans,
    runs,
    year,
  ]);

  const typeGaps = useMemo(() => {
    const checklistPlanned = countChecklistMonthSelections(
      selectedTarget?.checklistMonths,
    );
    const checklistRegistered = countRunsInTypeFolder(
      runs,
      "CHECKLIST",
      year,
    );
    const checklistRow = {
      type: "CHECKLIST" as InspectionType,
      planned: checklistPlanned,
      registered: checklistRegistered,
      gap: checklistPlanned - checklistRegistered,
    };

    const otherRows = GAP_TYPES.map((type) => {
      const planned =
        selectedTarget?.counts[type]?.shift ??
        emptyAnnualPlanPeriodCounts().shift;
      const registered = countRunsInTypeFolder(runs, type, year);
      return {
        type,
        planned,
        registered,
        gap: planned - registered,
      };
    });

    return [checklistRow, ...otherRows];
  }, [selectedTarget, runs, year]);

  const hasRows =
    missingChecklists.length > 0 ||
    typeGaps.some((row) => row.planned > 0 || row.registered > 0);

  return (
    <section className="min-w-0 rounded-md border border-[var(--border)] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
        <h2 className="min-w-0 text-sm font-semibold leading-snug text-[var(--fg)]">
          Төлөвлөгөөний зөрүү
        </h2>
        <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
          Он
          <select
            className="input py-1 text-xs"
            value={year}
            onChange={(event) =>
              setYear(Number(event.target.value) || defaultYear)
            }
          >
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="min-w-0 p-3">
        {!hasRows ? (
          <div className="rounded-md border border-dashed border-[var(--border)] px-3 py-6 text-center text-sm text-[var(--muted)]">
            Сонгосон онд харуулах зөрүү алга.
          </div>
        ) : (
          <div className="max-h-[22rem] min-w-0 overflow-auto rounded-md border border-[var(--border)] sm:max-h-[28rem]">
            <table className="!w-full min-w-0">
              <thead>
                <tr>
                  <th className="sticky top-0 z-[1] w-full bg-slate-50">
                    Агуулга
                  </th>
                  <th className="sticky top-0 z-[1] !w-px whitespace-nowrap !px-1.5 bg-slate-50 text-right">
                    Төлөвлөгөө
                  </th>
                  <th className="sticky top-0 z-[1] !w-px whitespace-nowrap !px-1.5 bg-slate-50 text-right">
                    Бүртгэл
                  </th>
                  <th className="sticky top-0 z-[1] !w-px whitespace-nowrap !px-1.5 bg-slate-50 text-right">
                    Зөрүү
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-slate-50">
                  <td
                    colSpan={4}
                    className="text-xs font-semibold text-[var(--muted)]"
                  >
                    Хяналт шалгалтын хуудас / Шөнийн / Хамтарсан / Баримт бичгийн
                    ХШ · тооны зөрүү
                  </td>
                </tr>
                {typeGaps.map((row) => (
                  <tr key={row.type}>
                    <td
                      className="min-w-0 text-sm font-medium leading-snug"
                      title={INSPECTION_TYPE_LABELS[row.type]}
                    >
                      <div className="line-clamp-3">
                        {INSPECTION_TYPE_LABELS[row.type]}
                      </div>
                    </td>
                    <td className="!w-px whitespace-nowrap !px-1.5 text-right tabular-nums">
                      {row.planned}
                    </td>
                    <td className="!w-px whitespace-nowrap !px-1.5 text-right tabular-nums">
                      {row.registered}
                    </td>
                    <td
                      className={`!w-px whitespace-nowrap !px-1.5 text-right tabular-nums font-semibold ${
                        row.gap === 0
                          ? "text-emerald-700"
                          : row.gap > 0
                            ? "text-amber-700"
                            : "text-rose-700"
                      }`}
                    >
                      {row.gap > 0 ? `+${row.gap}` : row.gap}
                    </td>
                  </tr>
                ))}

                {missingChecklists.length > 0 ? (
                  <tr className="bg-slate-50">
                    <td
                      colSpan={4}
                      className="text-xs font-semibold text-[var(--muted)]"
                    >
                      Хяналт шалгалтын хуудас · бүртгэгдээгүй
                    </td>
                  </tr>
                ) : null}
                {missingChecklists.map((row) => {
                  const fullLabel = `${row.code} · ${row.title}`;
                  return (
                    <tr key={`missing-${row.id}`}>
                      <td
                        className="min-w-0 text-sm leading-snug"
                        title={fullLabel}
                      >
                        <div className="line-clamp-3">
                          <span className="font-medium">{row.code}</span>
                          <span className="text-[var(--muted)]">
                            {" "}
                            · {row.title}
                          </span>
                        </div>
                      </td>
                      <td className="!w-px whitespace-nowrap !px-1.5 text-right tabular-nums">
                        {row.plannedMonths}
                      </td>
                      <td className="!w-px whitespace-nowrap !px-1.5 text-right tabular-nums">
                        {row.registeredRuns}
                      </td>
                      <td className="!w-px whitespace-nowrap !px-1.5 text-right">
                        <span
                          className="inline-flex text-amber-700"
                          title="Жилийн төлөвлөгөөнд бүртгэгдээгүй"
                          aria-label="Жилийн төлөвлөгөөнд бүртгэгдээгүй"
                        >
                          <CircleAlert aria-hidden="true" className="h-4 w-4" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-[var(--muted)]">
          «Бүртгэл» нь Шалгалтын гүйцэтгэл дэх холбогдох ХШ folder-т орсон,
          зөвхөн «Хийгдсэн» төлөвтэй шалгалтын тоо. «Төлөвлөгөө» нь жилийн
          төлөвлөгөөний тоо.
        </p>
      </div>
    </section>
  );
}
