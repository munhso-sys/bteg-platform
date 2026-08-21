"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { FilePenLine } from "lucide-react";
import { TableScroll } from "@/components/ui/primitives";
import type {
  AnnualPlanPeriodCounts,
  AnnualPlanRow,
  AnnualPlanTypeTarget,
  InspectionRun,
  InspectionTemplate,
  InspectionType,
} from "@/lib/types";
import {
  ANNUAL_PLAN_TYPE_ORDER,
  countChecklistMonthSelections,
  emptyAnnualPlanPeriodCounts,
  emptyAnnualPlanTypeCounts,
  emptyChecklistMonthRow,
  INSPECTION_TYPE_LABELS,
  normalizeChecklistMonths,
  normalizeRunExecutionStatus,
} from "@/lib/types";

const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1);

const EXCLUDED_TEMPLATE_CODES = new Set(["JOINT", "NIGHT"]);
const EXCLUDED_TEMPLATE_LABELS = new Set([
  INSPECTION_TYPE_LABELS.NIGHT_INSPECTION,
  INSPECTION_TYPE_LABELS.JOINT_INSPECTION,
  INSPECTION_TYPE_LABELS.DOCUMENT_INSPECTION,
  INSPECTION_TYPE_LABELS.UNPLANNED_INSPECTION,
]);

function periodOf(
  counts: Partial<Record<InspectionType, AnnualPlanPeriodCounts>>,
  type: InspectionType,
): AnnualPlanPeriodCounts {
  return counts[type] ?? emptyAnnualPlanPeriodCounts();
}

function isRegularChecklistTemplate(template: InspectionTemplate) {
  if (!template.active) return false;
  if (EXCLUDED_TEMPLATE_CODES.has(template.code)) return false;
  if (EXCLUDED_TEMPLATE_LABELS.has(template.category)) return false;
  if (EXCLUDED_TEMPLATE_LABELS.has(template.title)) return false;
  return true;
}

function cloneChecklistMonths(
  value: Record<string, boolean[]> | null | undefined,
  templateIds: string[],
): Record<string, boolean[]> {
  const source = normalizeChecklistMonths(value);
  const next: Record<string, boolean[]> = {};
  for (const id of templateIds) {
    next[id] = [...(source[id] ?? emptyChecklistMonthRow())];
  }
  return next;
}

function matchesPlanRow(run: InspectionRun, row: AnnualPlanRow) {
  if (run.planId) return run.planId === row.id;
  if (row.templateId && run.templateId === row.templateId) {
    return run.inspectionType === row.inspectionType;
  }
  if (run.inspectionType !== row.inspectionType) return false;
  const planName = row.checklistName.toLocaleLowerCase();
  const runTitle = run.title.toLocaleLowerCase();
  return Boolean(
    planName &&
      (runTitle.includes(planName) || planName.includes(runTitle)),
  );
}

function isPlanCompleted(row: AnnualPlanRow, runs: InspectionRun[]) {
  if (row.metric === "completed") return true;
  const matched = runs
    .filter((run) => matchesPlanRow(run, row))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  if (matched.length === 0) return false;
  const linked = matched.filter((run) => run.planId === row.id);
  const primary = (linked.length > 0 ? linked : matched)[0];
  return normalizeRunExecutionStatus(primary.status) === "completed";
}

function isTemplateCompletedInMonth(input: {
  templateId: string;
  year: number;
  month: number; // 1..12
  plans: AnnualPlanRow[];
  runs: InspectionRun[];
}): boolean {
  const monthKey = String(input.month);
  const monthPad = String(input.month).padStart(2, "0");

  for (const run of input.runs) {
    if (normalizeRunExecutionStatus(run.status) !== "completed") continue;
    if (run.templateId !== input.templateId) continue;
    const date = String(run.completedDate || run.inspectionDate || "");
    const runYear = Number(date.slice(0, 4));
    const runMonth = Number(date.slice(5, 7));
    if (runYear === input.year && runMonth === input.month) return true;
    // Linked plan for this year+month
    if (run.planId) {
      const plan = input.plans.find((row) => row.id === run.planId);
      if (
        plan &&
        plan.year === input.year &&
        plan.templateId === input.templateId &&
        Number(plan.months?.[monthKey] || 0) > 0
      ) {
        return true;
      }
    }
  }

  for (const plan of input.plans) {
    if (plan.year !== input.year) continue;
    if (plan.templateId !== input.templateId) continue;
    if (Number(plan.months?.[monthKey] || 0) <= 0) continue;
    if (plan.metric === "completed") return true;
    if (isPlanCompleted(plan, input.runs)) {
      // Prefer date-matched completion; if plan completed and only one month, count it
      const plannedMonths = Object.entries(plan.months || {})
        .filter(([, count]) => Number(count) > 0)
        .map(([m]) => Number(m));
      if (plannedMonths.length === 1 && plannedMonths[0] === input.month) {
        return true;
      }
      const matched = input.runs
        .filter((run) => matchesPlanRow(run, plan))
        .filter((run) => normalizeRunExecutionStatus(run.status) === "completed");
      for (const run of matched) {
        const date = String(run.completedDate || run.inspectionDate || "");
        if (date.startsWith(`${input.year}-${monthPad}`)) return true;
      }
    }
  }

  return false;
}

export function AnnualPlanByTypePanel({
  targets,
  templates,
  defaultYear,
  saveAction,
  readOnly = false,
}: {
  targets: AnnualPlanTypeTarget[];
  templates: InspectionTemplate[];
  defaultYear: number;
  saveAction: (formData: FormData) => void | Promise<void>;
  readOnly?: boolean;
}) {
  const checklistTemplates = useMemo(
    () =>
      templates
        .filter(isRegularChecklistTemplate)
        .sort((a, b) =>
          a.code.localeCompare(b.code, undefined, { numeric: true }),
        ),
    [templates],
  );
  const checklistTemplateIds = useMemo(
    () => checklistTemplates.map((template) => template.id),
    [checklistTemplates],
  );

  const router = useRouter();
  const [year, setYear] = useState(defaultYear);
  const [openType, setOpenType] = useState<InspectionType | null>(null);
  const [draftNotes, setDraftNotes] = useState<
    Partial<Record<InspectionType, string>>
  >({});
  const [draftTotals, setDraftTotals] = useState<
    Partial<Record<InspectionType, number>>
  >({});
  const [checklistMonths, setChecklistMonths] = useState<
    Record<string, boolean[]>
  >({});
  const [modalChecklistMonths, setModalChecklistMonths] = useState<
    Record<string, boolean[]>
  >({});
  const [modalTotal, setModalTotal] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const selected = useMemo(
    () => targets.find((row) => row.year === year) ?? null,
    [targets, year],
  );
  const counts = selected?.counts ?? emptyAnnualPlanTypeCounts();
  const notes = selected?.notes ?? {};
  const checklistIdsKey = checklistTemplateIds.join("|");

  useEffect(() => {
    const id = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const nextNotes: Partial<Record<InspectionType, string>> = {};
    const nextTotals: Partial<Record<InspectionType, number>> = {};
    const nextChecklist = cloneChecklistMonths(
      selected?.checklistMonths,
      checklistTemplateIds,
    );
    for (const type of ANNUAL_PLAN_TYPE_ORDER) {
      nextNotes[type] = notes[type] ?? "";
      nextTotals[type] =
        type === "CHECKLIST"
          ? countChecklistMonthSelections(nextChecklist)
          : periodOf(counts, type).shift;
    }
    const id = window.setTimeout(() => {
      setDraftNotes(nextNotes);
      setDraftTotals(nextTotals);
      setChecklistMonths(nextChecklist);
      setModalChecklistMonths(nextChecklist);
      setOpenType(null);
      setConfirmError(null);
    }, 0);
    return () => window.clearTimeout(id);
  }, [year, selected?.updatedAt, checklistIdsKey]);

  const grandTotal = ANNUAL_PLAN_TYPE_ORDER.reduce(
    (sum, type) => sum + (Number(draftTotals[type]) || 0),
    0,
  );
  const modalCheckedCount = countChecklistMonthSelections(modalChecklistMonths);

  function buildSaveFormData(
    nextTotals: Partial<Record<InspectionType, number>>,
    nextChecklist: Record<string, boolean[]>,
    nextNotes: Partial<Record<InspectionType, string>>,
  ) {
    const fd = new FormData();
    fd.set("year", String(year));
    fd.set("checklistMonths", JSON.stringify(nextChecklist));
    for (const type of ANNUAL_PLAN_TYPE_ORDER) {
      fd.set(`total:${type}`, String(Number(nextTotals[type]) || 0));
      fd.set(`note:${type}`, String(nextNotes[type] ?? ""));
    }
    return fd;
  }

  function openDetail(type: InspectionType) {
    setConfirmError(null);
    if (type === "CHECKLIST") {
      setModalChecklistMonths(
        cloneChecklistMonths(checklistMonths, checklistTemplateIds),
      );
    } else {
      setModalTotal(Number(draftTotals[type]) || 0);
    }
    setOpenType(type);
  }

  async function saveByTypeViaApi(formData: FormData) {
    const SAVE_TIMEOUT_MS = 20_000;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), SAVE_TIMEOUT_MS);
    try {
      const res = await fetch("/api/plans/by-type", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      let data: { ok?: boolean; error?: string } | null = null;
      try {
        data = (await res.json()) as { ok?: boolean; error?: string };
      } catch {
        data = null;
      }
      if (!res.ok || !data?.ok) {
        throw new Error(
          data?.error ||
            (res.status === 404
              ? "Хадгалах API олдсонгүй. Хуудсыг шинэчилнэ үү."
              : `Хадгалж чадсангүй (${res.status})`),
        );
      }
      router.refresh();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("Хадгалах хэт удаан байна. Дахин оролдоно уу.");
      }
      throw error;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function confirmChecklistModal() {
    const next = cloneChecklistMonths(
      modalChecklistMonths,
      checklistTemplateIds,
    );
    const nextTotals = {
      ...draftTotals,
      CHECKLIST: countChecklistMonthSelections(next),
    };
    setChecklistMonths(next);
    setDraftTotals(nextTotals);
    setConfirmError(null);
    setPendingConfirm(true);
    void (async () => {
      try {
        await saveByTypeViaApi(
          buildSaveFormData(nextTotals, next, draftNotes),
        );
        setOpenType(null);
      } catch (error) {
        setConfirmError(
          error instanceof Error ? error.message : "Хадгалж чадсангүй",
        );
      } finally {
        setPendingConfirm(false);
      }
    })();
  }

  function confirmTypeTotalModal() {
    if (!openType || openType === "CHECKLIST") return;
    const type = openType;
    const value = Math.max(0, Number(modalTotal) || 0);
    const nextTotals = {
      ...draftTotals,
      [type]: value,
    };
    setDraftTotals(nextTotals);
    setConfirmError(null);
    setPendingConfirm(true);
    void (async () => {
      try {
        await saveByTypeViaApi(
          buildSaveFormData(nextTotals, checklistMonths, draftNotes),
        );
        setOpenType(null);
      } catch (error) {
        setConfirmError(
          error instanceof Error ? error.message : "Хадгалж чадсангүй",
        );
      } finally {
        setPendingConfirm(false);
      }
    })();
  }

  function resetChecklistModal() {
    const cleared: Record<string, boolean[]> = {};
    for (const id of checklistTemplateIds) {
      cleared[id] = emptyChecklistMonthRow();
    }
    setModalChecklistMonths(cleared);
  }

  function toggleMonth(templateId: string, monthIndex: number) {
    setModalChecklistMonths((current) => {
      const row = [...(current[templateId] ?? emptyChecklistMonthRow())];
      row[monthIndex] = !row[monthIndex];
      return { ...current, [templateId]: row };
    });
  }

  const checklistModal =
    mounted && !readOnly && openType === "CHECKLIST"
      ? createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-3 md:p-4"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !pendingConfirm) {
                setOpenType(null);
              }
            }}
          >
            <div
              className="flex h-[100dvh] w-full max-w-[min(100vw,80rem)] flex-col overflow-hidden rounded-none border border-[var(--border)] bg-white shadow-lg sm:h-[min(90dvh,52rem)] sm:max-h-[90dvh] sm:w-[min(96vw,80rem)] sm:rounded-md dark:bg-[var(--card)]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="checklist-plan-modal-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex shrink-0 items-start justify-between gap-2 border-b border-[var(--border)] px-3 py-3 sm:px-4">
                <div className="min-w-0">
                  <h3
                    id="checklist-plan-modal-title"
                    className="text-sm font-semibold leading-snug text-[var(--fg)]"
                  >
                    Хяналт шалгалтын хуудас · сарын төлөвлөгөө
                  </h3>
                  <p className="text-xs text-[var(--muted)]">
                    Сонгосон тэмдэглэгээ: {modalCheckedCount}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn shrink-0 px-2 py-1 text-xs"
                  disabled={pendingConfirm}
                  onClick={() => setOpenType(null)}
                >
                  Хаах
                </button>
              </div>
              <div className="min-h-0 min-w-0 flex-1 overflow-hidden p-2 sm:p-3">
                {checklistTemplates.length === 0 ? (
                  <div className="rounded-md border border-dashed border-[var(--border)] px-3 py-8 text-center text-sm text-[var(--muted)]">
                    Хяналтын хуудсуудаас харуулах ХШ хуудас олдсонгүй.
                  </div>
                ) : (
                  <TableScroll
                    size="lg"
                    maxHeightClass="h-full max-h-full"
                    className="h-full min-h-0"
                  >
                    <table>
                      <thead>
                        <tr>
                          <th className="min-w-[10rem] sm:min-w-[16rem]">
                            ХШ хуудас
                          </th>
                          {MONTHS.map((month) => (
                            <th
                              key={month}
                              className="w-8 px-1 text-center sm:w-12 sm:px-2"
                            >
                              {month}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {checklistTemplates.map((template) => {
                          const row =
                            modalChecklistMonths[template.id] ??
                            emptyChecklistMonthRow();
                          return (
                            <tr key={template.id}>
                              <td className="text-sm" title={template.title}>
                                <div className="font-medium">{template.code}</div>
                                <div className="line-clamp-2 text-xs text-[var(--muted)]">
                                  {template.title}
                                </div>
                              </td>
                              {MONTHS.map((month, monthIndex) => (
                                <td
                                  key={month}
                                  className="px-1 text-center sm:px-2"
                                >
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 accent-[var(--brand)]"
                                    checked={Boolean(row[monthIndex])}
                                    onChange={() =>
                                      toggleMonth(template.id, monthIndex)
                                    }
                                    aria-label={`${template.code} ${month}-р сар`}
                                  />
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </TableScroll>
                )}
              </div>
              <div className="flex shrink-0 flex-col gap-2 border-t border-[var(--border)] px-3 py-3 sm:px-4">
                {confirmError ? (
                  <p className="text-xs text-rose-600 dark:text-rose-400">
                    {confirmError}
                  </p>
                ) : null}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    className="btn w-full sm:w-auto"
                    disabled={pendingConfirm}
                    onClick={resetChecklistModal}
                  >
                    Цэвэрлэх
                  </button>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      className="btn w-full sm:w-auto"
                      disabled={pendingConfirm}
                      onClick={() => setOpenType(null)}
                    >
                      Болих
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary w-full sm:w-auto"
                      disabled={pendingConfirm}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        confirmChecklistModal();
                      }}
                    >
                      {pendingConfirm ? "Хадгалж байна…" : "Баталгаажуулах"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  const typeTotalModal =
    mounted && !readOnly && openType && openType !== "CHECKLIST"
      ? createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/50 p-0 sm:items-center sm:p-4"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !pendingConfirm) {
                setOpenType(null);
              }
            }}
          >
            <div
              className="w-full max-w-sm rounded-t-md border border-[var(--border)] bg-white shadow-lg sm:rounded-md dark:bg-[var(--card)]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="type-total-modal-title"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
                <h3
                  id="type-total-modal-title"
                  className="min-w-0 text-sm font-semibold text-[var(--fg)]"
                >
                  {INSPECTION_TYPE_LABELS[openType]}
                </h3>
                <button
                  type="button"
                  className="btn shrink-0 px-2 py-1 text-xs"
                  disabled={pendingConfirm}
                  onClick={() => setOpenType(null)}
                >
                  Хаах
                </button>
              </div>
              <div className="space-y-3 p-4">
                <label className="grid gap-1 text-xs font-medium text-[var(--muted)]">
                  Тоо
                  <input
                    className="input"
                    type="number"
                    min={0}
                    value={modalTotal}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setModalTotal(
                        Number.isNaN(value) ? 0 : Math.max(0, value),
                      );
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        confirmTypeTotalModal();
                      }
                    }}
                    autoFocus
                  />
                </label>
                {confirmError ? (
                  <p className="text-xs text-rose-600 dark:text-rose-400">
                    {confirmError}
                  </p>
                ) : null}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    className="btn w-full sm:w-auto"
                    disabled={pendingConfirm}
                    onClick={() => setOpenType(null)}
                  >
                    Болих
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary w-full sm:w-auto"
                    disabled={pendingConfirm}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      confirmTypeTotalModal();
                    }}
                  >
                    {pendingConfirm ? "Хадгалж байна…" : "Баталгаажуулах"}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <section className="min-w-0 rounded-md border border-[var(--border)] bg-white">
        <div className="flex items-start justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
          <h2 className="min-w-0 text-sm font-semibold leading-snug text-[var(--fg)]">
            {readOnly
              ? "ХШ төрлөөр жилийн төлөвлөгөө"
              : "ХШ төрлөөр жилийн төлөвлөгөө оруулах"}
          </h2>
          <span className="shrink-0 text-xs text-[var(--muted)]">
            {readOnly ? "Зөвхөн харах" : "4 төрөл"}
          </span>
        </div>
        {readOnly ? (
          <div className="space-y-3 p-3">
            <label className="flex w-full max-w-[12rem] flex-col gap-1 text-xs font-medium text-[var(--muted)]">
              Он
              <input
                className="input"
                type="number"
                min={2000}
                max={2100}
                value={year}
                onChange={(event) =>
                  setYear(Number(event.target.value) || defaultYear)
                }
              />
            </label>
            <div className="min-w-0 overflow-x-auto rounded-md border border-[var(--border)]">
              <table className="!w-full min-w-0">
                <thead>
                  <tr>
                    <th className="w-full">ХШ-ын төрөл</th>
                    <th className="!w-px whitespace-nowrap !px-1.5 text-right">
                      Нийт
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ANNUAL_PLAN_TYPE_ORDER.map((type) => {
                    const total = Number(draftTotals[type]) || 0;
                    return (
                      <tr key={type}>
                        <td className="w-full min-w-0 text-sm font-medium leading-snug">
                          {INSPECTION_TYPE_LABELS[type]}
                        </td>
                        <td className="!w-px whitespace-nowrap !px-1.5 text-right">
                          <span className="tabular-nums font-semibold">
                            {total}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50 font-semibold">
                    <td className="w-full text-sm">Нийт</td>
                    <td className="!w-px whitespace-nowrap !px-1.5 text-right tabular-nums">
                      {grandTotal}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-[var(--muted)]">
              Нэгжийн удирдлага / Ахлах мэргэжилтэн зөвхөн харах эрхтэй. Засахыг
              ДХШХ хийнэ.
            </p>
          </div>
        ) : (
        <form action={saveAction} className="space-y-3 p-3">
          <label className="flex w-full max-w-[12rem] flex-col gap-1 text-xs font-medium text-[var(--muted)]">
            Он
            <input
              className="input"
              type="number"
              name="year"
              min={2000}
              max={2100}
              value={year}
              onChange={(event) =>
                setYear(Number(event.target.value) || defaultYear)
              }
            />
          </label>

          {ANNUAL_PLAN_TYPE_ORDER.map((type) => (
            <input
              key={`note-hidden-${type}`}
              type="hidden"
              name={`note:${type}`}
              value={draftNotes[type] ?? ""}
            />
          ))}
          <input
            type="hidden"
            name="checklistMonths"
            value={JSON.stringify(checklistMonths)}
          />
          {ANNUAL_PLAN_TYPE_ORDER.map((type) => (
            <input
              key={`total-hidden-${type}`}
              type="hidden"
              name={`total:${type}`}
              value={Number(draftTotals[type]) || 0}
            />
          ))}

          <div className="min-w-0 overflow-x-auto rounded-md border border-[var(--border)]">
            <table className="!w-full min-w-0">
              <thead>
                <tr>
                  <th className="w-full">ХШ-ын төрөл</th>
                  <th className="!w-px whitespace-nowrap !px-1.5 text-right">
                    Нийт
                  </th>
                  <th className="!w-px whitespace-nowrap !px-1 text-right" />
                </tr>
              </thead>
              <tbody>
                {ANNUAL_PLAN_TYPE_ORDER.map((type) => {
                  const total = Number(draftTotals[type]) || 0;
                  return (
                    <tr key={type}>
                      <td className="w-full min-w-0 text-sm font-medium leading-snug">
                        {INSPECTION_TYPE_LABELS[type]}
                      </td>
                      <td className="!w-px whitespace-nowrap !px-1.5 text-right">
                        <span className="tabular-nums font-semibold">
                          {total}
                        </span>
                      </td>
                      <td className="!w-px whitespace-nowrap !px-1 text-right">
                        <button
                          type="button"
                          className="btn btn-primary p-1.5"
                          title="Нэмэлт мэдээлэл"
                          aria-label={`${INSPECTION_TYPE_LABELS[type]} нэмэлт мэдээлэл`}
                          onClick={() => openDetail(type)}
                        >
                          <FilePenLine aria-hidden="true" className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-50 font-semibold">
                  <td className="w-full text-sm">Нийт</td>
                  <td className="!w-px whitespace-nowrap !px-1.5 text-right tabular-nums">
                    {grandTotal}
                  </td>
                  <td className="!w-px !px-1" />
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3">
            <div className="text-sm text-[var(--muted)]">
              Нийт төлөвлөсөн:{" "}
              <span className="font-semibold text-[var(--fg)]">{grandTotal}</span>
            </div>
            <button className="btn btn-primary w-full" type="submit">
              Төлөвлөгөө хадгалах
            </button>
          </div>
        </form>
        )}
      </section>

      {checklistModal}
      {typeTotalModal}
    </>
  );
}

export function AnnualPlanByTypeHistory({
  targets,
  templates,
  plans,
  runs,
}: {
  targets: AnnualPlanTypeTarget[];
  templates: InspectionTemplate[];
  plans: AnnualPlanRow[];
  runs: InspectionRun[];
}) {
  const templateById = useMemo(() => {
    const map = new Map<string, InspectionTemplate>();
    for (const template of templates) map.set(template.id, template);
    return map;
  }, [templates]);

  const years = useMemo(
    () =>
      targets
        .slice()
        .sort((a, b) => b.year - a.year)
        .map((row) => row.year),
    [targets],
  );

  const [selectedYear, setSelectedYear] = useState<number | null>(
    years[0] ?? null,
  );
  const [activeMonth, setActiveMonth] = useState<number | null>(null);
  const [yearsEpoch, setYearsEpoch] = useState(years);
  const [selectedYearEpoch, setSelectedYearEpoch] = useState(selectedYear);

  if (years !== yearsEpoch) {
    setYearsEpoch(years);
    if (years.length === 0) {
      setSelectedYear(null);
    } else if (selectedYear == null || !years.includes(selectedYear)) {
      setSelectedYear(years[0]);
    }
  }

  if (selectedYear !== selectedYearEpoch) {
    setSelectedYearEpoch(selectedYear);
    setActiveMonth(null);
  }

  const selected = useMemo(
    () => targets.find((row) => row.year === selectedYear) ?? null,
    [targets, selectedYear],
  );

  const monthSeries = useMemo(() => {
    const checklistMonths = normalizeChecklistMonths(selected?.checklistMonths);
    return MONTHS.map((month, monthIndex) => {
      const items: {
        id: string;
        code: string;
        title: string;
        completed: boolean;
      }[] = [];
      for (const [templateId, months] of Object.entries(checklistMonths)) {
        if (!months[monthIndex]) continue;
        const template = templateById.get(templateId);
        // Planned chart = regular checklist only (no night / joint / document)
        if (template && !isRegularChecklistTemplate(template)) continue;
        if (!template) continue;
        items.push({
          id: templateId,
          code: template.code,
          title: template.title,
          completed:
            selectedYear == null
              ? false
              : isTemplateCompletedInMonth({
                  templateId,
                  year: selectedYear,
                  month,
                  plans,
                  runs,
                }),
        });
      }
      items.sort((a, b) =>
        a.code.localeCompare(b.code, undefined, { numeric: true }),
      );
      const completedCount = items.filter((item) => item.completed).length;
      return {
        month,
        count: items.length,
        completedCount,
        pendingCount: items.length - completedCount,
        items,
      };
    });
  }, [
    selected?.checklistMonths,
    templateById,
    selectedYear,
    plans,
    runs,
  ]);

  // Scale Y to max of planned or completed so both series stay visible
  const maxCount = Math.max(
    1,
    ...monthSeries.map((row) => Math.max(row.count, row.completedCount)),
  );
  const yTicks = useMemo(() => {
    const top = Math.max(1, maxCount);
    const step = top <= 4 ? 1 : Math.ceil(top / 4);
    const ticks: number[] = [];
    for (let value = 0; value <= top; value += step) ticks.push(value);
    if (ticks[ticks.length - 1] !== top) ticks.push(top);
    return ticks;
  }, [maxCount]);

  const checklistTotal = countChecklistMonthSelections(
    selected?.checklistMonths,
  );
  const otherTotals = ANNUAL_PLAN_TYPE_ORDER.filter(
    (type) => type !== "CHECKLIST",
  ).map((type) => ({
    type,
    total: selected ? periodOf(selected.counts, type).shift : 0,
  }));
  const active =
    activeMonth != null
      ? monthSeries.find((row) => row.month === activeMonth) ?? null
      : null;

  const completedLinePoints = useMemo(() => {
    return monthSeries
      .map((row, index) => {
        if (row.completedCount <= 0) return null;
        const x = ((index + 0.5) / 12) * 100;
        const y = 100 - (row.completedCount / maxCount) * 100;
        return { x, y, month: row.month, count: row.completedCount };
      })
      .filter(Boolean) as Array<{
      x: number;
      y: number;
      month: number;
      count: number;
    }>;
  }, [monthSeries, maxCount]);

  const completedLinePath = useMemo(() => {
    if (completedLinePoints.length === 0) return "";
    return completedLinePoints
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
      .join(" ");
  }, [completedLinePoints]);

  function activateMonth(month: number) {
    setActiveMonth(month);
  }

  return (
    <section className="min-w-0 rounded-md border border-[var(--border)] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
        <h2 className="min-w-0 text-sm font-semibold leading-snug text-[var(--fg)]">
          Оруулсан жилийн төлөвлөгөө
        </h2>
        <div className="flex items-center gap-2">
          {years.length > 0 ? (
            <label className="flex items-center gap-1.5 text-xs text-[var(--muted)]">
              Он
              <select
                className="input py-1 text-xs"
                value={selectedYear ?? ""}
                onChange={(event) =>
                  setSelectedYear(Number(event.target.value) || null)
                }
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="text-xs text-[var(--muted)]">0 он</span>
          )}
        </div>
      </div>

      <div className="min-w-0 space-y-3 p-3">
        {targets.length === 0 || !selected ? (
          <div className="rounded-md border border-dashed border-[var(--border)] px-3 py-8 text-center text-sm text-[var(--muted)]">
            Одоогоор төрлөөр оруулсан жилийн төлөвлөгөө алга.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
              <span className="rounded border border-[var(--border)] bg-slate-50 px-2 py-1">
                Хяналт шалгалтын хуудас:{" "}
                <span className="font-semibold text-[var(--fg)]">
                  {checklistTotal}
                </span>
              </span>
              {otherTotals.map(({ type, total }) => (
                <span
                  key={type}
                  className="rounded border border-[var(--border)] bg-slate-50 px-2 py-1"
                >
                  {INSPECTION_TYPE_LABELS[type]}:{" "}
                  <span className="font-semibold text-[var(--fg)]">{total}</span>
                </span>
              ))}
            </div>

            <div className="min-w-0 rounded-md border border-[var(--border)] p-2 sm:p-3">
              <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between sm:gap-2">
                <div className="text-sm font-semibold text-[var(--fg)]">
                  Сарын ХШ төлөвлөгөө
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-[var(--brand)]" />
                    Төлөвлөсөн ХШ
                    <span className="text-[10px] opacity-80">
                      (шөнийн/хамтарсан/баримт бичгийн ХШ орохгүй)
                    </span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-600" />
                    Хийгдсэн ХШ
                  </span>
                  <span>шинэчилсэн {selected.updatedAt.slice(0, 10)}</span>
                </div>
              </div>

              <div className="min-w-0">
                <div className="relative grid min-w-0 grid-cols-[1.75rem_minmax(0,1fr)] gap-1 sm:grid-cols-[2rem_minmax(0,1fr)] sm:gap-2">
                  <div className="relative h-44 sm:h-56">
                    {yTicks.map((tick) => {
                      const bottom = (tick / maxCount) * 100;
                      return (
                        <div
                          key={tick}
                          className="absolute right-0 flex -translate-y-1/2 items-center gap-1"
                          style={{ bottom: `${bottom}%` }}
                        >
                          <span className="text-[10px] tabular-nums text-[var(--muted)]">
                            {tick}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="relative h-44 overflow-visible border-b border-l border-[var(--border)] sm:h-56">
                    {yTicks.map((tick) => (
                      <div
                        key={`grid-${tick}`}
                        className="pointer-events-none absolute inset-x-0 border-t border-dashed border-slate-200 dark:border-slate-700"
                        style={{ bottom: `${(tick / maxCount) * 100}%` }}
                      />
                    ))}

                    {/* Completed trend line + markers */}
                    <svg
                      className="pointer-events-none absolute inset-0 z-[2] h-full w-full"
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      aria-hidden
                    >
                      {completedLinePath ? (
                        <path
                          d={completedLinePath}
                          fill="none"
                          stroke="#059669"
                          strokeWidth="1.5"
                          vectorEffect="non-scaling-stroke"
                        />
                      ) : null}
                    </svg>

                    <div className="pointer-events-none absolute inset-0 z-[3] flex items-stretch px-0.5 pt-2 sm:px-1">
                      {monthSeries.map((row) => {
                        const bottomPct =
                          row.completedCount > 0
                            ? (row.completedCount / maxCount) * 100
                            : 0;
                        const isActive = activeMonth === row.month;
                        return (
                          <div
                            key={`point-${row.month}`}
                            className="relative min-w-0 flex-1"
                          >
                            {row.completedCount > 0 ? (
                              <span
                                className={`absolute left-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-sm ${
                                  isActive
                                    ? "border-emerald-200 bg-emerald-700"
                                    : "border-white bg-emerald-600 dark:border-slate-900"
                                }`}
                                style={{ bottom: `${bottomPct}%` }}
                              />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    {/* Interactive bars */}
                    <div className="absolute inset-0 z-[1] flex items-end gap-0.5 px-0.5 pb-0 pt-2 sm:gap-1 sm:px-1">
                      {monthSeries.map((row) => {
                        const heightPct =
                          row.count === 0 ? 0 : (row.count / maxCount) * 100;
                        const isActive = activeMonth === row.month;
                        return (
                          <button
                            key={row.month}
                            type="button"
                            className={`relative flex h-full min-w-0 flex-1 flex-col justify-end rounded-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${
                              isActive ? "bg-[var(--brand)]/10" : "hover:bg-slate-500/5"
                            }`}
                            aria-pressed={isActive}
                            aria-label={`${row.month}-р сар, ${row.count} ХШ`}
                            onMouseEnter={() => activateMonth(row.month)}
                            onFocus={() => activateMonth(row.month)}
                            onClick={() => activateMonth(row.month)}
                          >
                            <div
                              className={`mx-auto w-full max-w-[2.25rem] rounded-t transition-colors ${
                                isActive
                                  ? "bg-[var(--brand-dark)]"
                                  : "bg-[var(--brand)]"
                              } ${row.count === 0 ? "opacity-25" : ""}`}
                              style={{
                                height: `${heightPct}%`,
                                minHeight: row.count > 0 ? "4px" : "2px",
                              }}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div />
                  <div className="grid grid-cols-12 gap-0.5 px-0.5 sm:gap-1 sm:px-1">
                    {MONTHS.map((month) => {
                      const isActive = activeMonth === month;
                      return (
                        <button
                          key={`label-${month}`}
                          type="button"
                          className={`rounded py-0.5 text-center text-[10px] tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${
                            isActive
                              ? "font-semibold text-[var(--fg)]"
                              : "text-[var(--muted)] hover:text-[var(--fg)]"
                          }`}
                          aria-pressed={isActive}
                          onMouseEnter={() => activateMonth(month)}
                          onFocus={() => activateMonth(month)}
                          onClick={() => activateMonth(month)}
                        >
                          {month}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--surface-muted)]/40 p-2.5 dark:bg-[var(--surface-muted)]">
                {active ? (
                  <>
                    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-[var(--fg)]">
                        {active.month}-р сар · төлөвлөсөн {active.count} ·
                        хийгдсэн {active.completedCount} · үлдсэн{" "}
                        {active.pendingCount}
                      </div>
                      <button
                        type="button"
                        className="text-[11px] text-[var(--muted)] underline-offset-2 hover:underline"
                        onClick={() => setActiveMonth(null)}
                      >
                        Хаах
                      </button>
                    </div>
                    {active.items.length === 0 ? (
                      <div className="text-xs text-[var(--muted)]">
                        Энэ сард сонгосон ХШ алга.
                      </div>
                    ) : (
                      <ul className="soft-scroll max-h-44 space-y-1.5 text-xs text-[var(--fg)]">
                        {active.items.map((item) => (
                          <li
                            key={item.id}
                            className="flex items-start gap-1.5 leading-snug"
                          >
                            <span
                              className={`mt-1 inline-block h-2 w-2 shrink-0 rounded-sm ${
                                item.completed
                                  ? "bg-emerald-600"
                                  : "bg-[var(--brand)]"
                              }`}
                            />
                            <span className="min-w-0">
                              <span className="font-medium">{item.code}</span>
                              <span className="text-[var(--muted)]">
                                {" "}
                                · {item.title}
                              </span>
                              {item.completed ? (
                                <span className="text-emerald-700 dark:text-emerald-400">
                                  {" "}
                                  · Хийгдсэн
                                </span>
                              ) : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-[var(--muted)]">
                    Сарын багана эсвэл дугаар дээр дарж / hover хийж дэлгэрэнгүйг
                    харна.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
