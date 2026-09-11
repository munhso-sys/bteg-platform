"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  InspectionAnswer,
  InspectionTemplateQuestion,
  InspectionTemplateSection,
  RunStatus,
} from "@/lib/types";
import {
  COMPLIANCE_STATUS_LABELS,
  INSPECTION_RUN_SAVE_STATUS_OPTIONS,
  isInspectionRunSaveStatus,
  labelOf,
  type InspectionRunSaveStatus,
} from "@/lib/types";
import { StatusBadge, TableScroll } from "@/components/ui/primitives";
import {
  CHECKLIST_HEADER_ROW_CLASS,
  CHECKLIST_QUESTION_CELL_CLASS,
  CHECKLIST_SECTION_ROW_CLASS,
  CHECKLIST_SHEET_HEADERS,
  CHECKLIST_TOTAL_ROW_CLASS,
  buildChecklistSheetRows,
  grandApprovedTotal,
  legalMergeMetaByQuestionId,
  sectionApprovedTotal,
} from "@/lib/checklist-sheet";
import { deriveComplianceStatus } from "@/lib/scoring";
import { inspectionApiFetch } from "@/lib/access/inspection-api-fetch";

type Row = {
  answer: InspectionAnswer;
  question: InspectionTemplateQuestion | undefined;
};

function toSaveStatus(runStatus: RunStatus): InspectionRunSaveStatus {
  if (runStatus === "submitted") return "completed";
  if (isInspectionRunSaveStatus(runStatus)) return runStatus;
  return "in_progress";
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function RunScoringForm({
  runId,
  runStatus,
  inspectionDate,
  dueDate,
  completedDate,
  rows,
  sections = [],
  sheetTitle,
  readOnly = false,
}: {
  runId: string;
  runStatus: RunStatus;
  inspectionDate: string;
  dueDate?: string | null;
  completedDate?: string | null;
  rows: Row[];
  sections?: InspectionTemplateSection[];
  sheetTitle?: string;
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<InspectionRunSaveStatus>(
    toSaveStatus(runStatus),
  );
  const [startedDate, setStartedDate] = useState(inspectionDate);
  const [finishDueDate, setFinishDueDate] = useState(dueDate ?? "");
  const [finishedDate, setFinishedDate] = useState(completedDate ?? "");
  const locked = pending || busy || readOnly;
  const [drafts, setDrafts] = useState(() =>
    Object.fromEntries(
      rows.map(({ answer }) => [
        answer.id,
        {
          isApplicable: answer.isApplicable,
          receivedScore: answer.receivedScore,
        },
      ]),
    ),
  );

  const questions = useMemo(
    () =>
      rows
        .map((r) => r.question)
        .filter((q): q is InspectionTemplateQuestion => Boolean(q)),
    [rows],
  );

  const answerByQuestionId = useMemo(() => {
    const map = new Map<string, InspectionAnswer>();
    for (const row of rows) {
      if (row.question) map.set(row.question.id, row.answer);
    }
    return map;
  }, [rows]);

  const sheetRows = useMemo(
    () => buildChecklistSheetRows(sections, questions),
    [sections, questions],
  );
  const mergeMeta = useMemo(
    () => legalMergeMetaByQuestionId(sheetRows),
    [sheetRows],
  );

  const grandApproved = useMemo(
    () => grandApprovedTotal(questions),
    [questions],
  );
  const grandReceived = useMemo(() => {
    let sum = 0;
    for (const q of questions) {
      const answer = answerByQuestionId.get(q.id);
      if (!answer) continue;
      const draft = drafts[answer.id];
      const applicable = draft?.isApplicable ?? answer.isApplicable;
      if (!applicable) continue;
      sum += Number(draft?.receivedScore ?? answer.receivedScore) || 0;
    }
    return sum;
  }, [questions, answerByQuestionId, drafts]);

  function setDraft(
    answerId: string,
    patch: { isApplicable?: boolean; receivedScore?: number },
  ) {
    setDrafts((current) => ({
      ...current,
      [answerId]: {
        isApplicable:
          patch.isApplicable ?? current[answerId]?.isApplicable ?? true,
        receivedScore:
          patch.receivedScore ?? current[answerId]?.receivedScore ?? 0,
      },
    }));
  }

  function sectionReceivedTotal(sectionId: string): number {
    let sum = 0;
    for (const q of questions.filter((item) => item.sectionId === sectionId)) {
      const answer = answerByQuestionId.get(q.id);
      if (!answer) continue;
      const draft = drafts[answer.id];
      const applicable = draft?.isApplicable ?? answer.isApplicable;
      if (!applicable) continue;
      sum += Number(draft?.receivedScore ?? answer.receivedScore) || 0;
    }
    return sum;
  }

  async function saveAll() {
    if (readOnly) return;
    setMessage("");
    setBusy(true);
    const answers = rows.flatMap(({ answer }) => {
      const draft = drafts[answer.id];
      return draft ? [{ answerId: answer.id, ...draft }] : [];
    });
    const res = await inspectionApiFetch(`/api/runs/${runId}/answers`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers,
        status,
        inspectionDate: startedDate,
        dueDate: finishDueDate || null,
        completedDate: finishedDate || null,
        syncFindings: true,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setMessage(
        data?.error
          ? `Хадгалахад алдаа: ${data.error}`
          : `Хадгалахад алдаа гарлаа (${res.status})`,
      );
      return;
    }
    const payload = (await res.json().catch(() => null)) as {
      findings?: unknown[];
      actions?: unknown[];
    } | null;
    const findingCount = Array.isArray(payload?.findings)
      ? payload.findings.length
      : 0;
    const actionCount = Array.isArray(payload?.actions)
      ? payload.actions.length
      : 0;
    setMessage(
      `Хадгаллаа. Энэ ХШ дээр ${findingCount} зөрчил, ${actionCount} засах арга хэмжээ шинэчлэгдлээ.`,
    );
    startTransition(() => router.refresh());
  }

  async function resetAnswers() {
    setMessage("");
    setBusy(true);
    const res = await inspectionApiFetch(`/api/runs/${runId}/answers`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reset: true }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setMessage(
        data?.error
          ? `Дахин тохируулахад алдаа: ${data.error}`
          : `Дахин тохируулахад алдаа гарлаа (${res.status})`,
      );
      return;
    }
    setDrafts(
      Object.fromEntries(
        rows.map(({ answer }) => [
          answer.id,
          { isApplicable: true, receivedScore: 0 },
        ]),
      ),
    );
    setMessage("Дахин тохирууллаа");
    startTransition(() => router.refresh());
  }

  return (
    <div>
      {message ? (
        <div className="mb-3 rounded border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-sm text-[var(--fg)]">
          {message}
        </div>
      ) : null}
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Хадгалах төлөв</span>
          <select
            className="select min-w-48"
            value={status}
            disabled={locked}
            onChange={(event) =>
              setStatus(event.target.value as InspectionRunSaveStatus)
            }
          >
            {INSPECTION_RUN_SAVE_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Шалгалт эхлүүлсэн</span>
          <input
            className="input min-w-40"
            type="date"
            value={startedDate}
            disabled={locked}
            onChange={(event) => setStartedDate(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Дуусгах хугацаа</span>
          <input
            className="input min-w-40"
            type="date"
            value={finishDueDate}
            disabled={locked}
            onChange={(event) => setFinishDueDate(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Дуусгасан хугацаа</span>
          <input
            className="input min-w-40"
            type="date"
            value={finishedDate}
            disabled={locked}
            onChange={(event) => setFinishedDate(event.target.value)}
          />
        </label>
        {!readOnly ? (
          <>
            <button
              type="button"
              className="btn btn-primary"
              disabled={locked}
              onClick={() => void saveAll()}
            >
              Хадгалах
            </button>
            <button
              type="button"
              className="btn"
              disabled={locked}
              onClick={() => void resetAnswers()}
            >
              Дахин тохируулах
            </button>
          </>
        ) : (
          <p className="text-xs text-[var(--muted)]">
            Зөвхөн харах эрх · засах боломжгүй
          </p>
        )}
      </div>

      <TableScroll
        size="md"
        maxHeightClass="max-h-[40rem]"
        className="checklist-sheet-scroll"
      >
        <table className="checklist-sheet-table w-full text-sm">
          <thead>
            {sheetTitle ? (
              <tr>
                <th
                  colSpan={7}
                  className={cx(
                    "border border-[var(--border)] px-2 py-2 text-left font-semibold",
                    CHECKLIST_HEADER_ROW_CLASS,
                  )}
                >
                  {sheetTitle}
                </th>
              </tr>
            ) : null}
            <tr className={CHECKLIST_HEADER_ROW_CLASS}>
              <th className="w-12 border border-[var(--border)] px-1 py-1.5">
                {CHECKLIST_SHEET_HEADERS.no}
              </th>
              <th className="min-w-[10rem] border border-[var(--border)] px-1 py-1.5">
                {CHECKLIST_SHEET_HEADERS.legal}
              </th>
              <th className="min-w-[12rem] border border-[var(--border)] px-1 py-1.5">
                {CHECKLIST_SHEET_HEADERS.question}
              </th>
              <th className="w-20 border border-[var(--border)] px-1 py-1.5">
                {CHECKLIST_SHEET_HEADERS.approved}
              </th>
              <th className="w-20 border border-[var(--border)] px-1 py-1.5">
                {CHECKLIST_SHEET_HEADERS.received}
                <div className="text-[10px] font-normal normal-case text-[var(--muted)]">
                  хангаагүй оноо
                </div>
              </th>
              <th className="w-20 border border-[var(--border)] px-1 py-1.5">
                {CHECKLIST_SHEET_HEADERS.applicable}
              </th>
              <th className="w-24 border border-[var(--border)] px-1 py-1.5">
                {CHECKLIST_SHEET_HEADERS.status}
              </th>
            </tr>
          </thead>
          <tbody>
            {sheetRows.map((row) => {
              if (row.kind === "section") {
                return (
                  <tr
                    key={`s:${row.section.id}`}
                    className={CHECKLIST_SECTION_ROW_CLASS}
                  >
                    <td
                      colSpan={3}
                      className="border border-[var(--border)] px-2 py-1.5 font-semibold"
                    >
                      {row.section.title}
                    </td>
                    <td className="border border-[var(--border)] px-2 py-1.5 text-right tabular-nums font-semibold">
                      {sectionApprovedTotal(row.section.id, questions)}
                    </td>
                    <td className="border border-[var(--border)] px-2 py-1.5 text-right tabular-nums font-semibold">
                      {sectionReceivedTotal(row.section.id)}
                    </td>
                    <td
                      colSpan={2}
                      className="border border-[var(--border)]"
                    />
                  </tr>
                );
              }

              const q = row.question;
              const answer = answerByQuestionId.get(q.id);
              if (!answer) return null;
              const meta = mergeMeta.get(q.id);
              const showLegal = !meta?.skip;
              const rowSpan = meta?.rowSpan ?? 1;
              const draft = drafts[answer.id];
              const received = draft?.receivedScore ?? 0;
              const applicable = draft?.isApplicable ?? true;
              const liveStatus = deriveComplianceStatus(
                applicable,
                answer.approvedScore,
                received,
              );

              return (
                <tr key={`q:${q.id}`}>
                  <td className="border border-[var(--border)] px-2 py-1 text-center tabular-nums font-medium">
                    {q.questionNo}
                  </td>
                  {showLegal ? (
                    <td
                      rowSpan={rowSpan}
                      className={cx(
                        "checklist-legal-cell border border-[var(--border)] px-2 py-1 align-top text-xs whitespace-pre-wrap",
                        rowSpan > 1 &&
                          "checklist-legal-cell--merged bg-[#FFF2CC]/60 dark:bg-amber-950/30",
                      )}
                    >
                      <div className="checklist-legal-sticky">
                        {q.legalReference || "—"}
                      </div>
                    </td>
                  ) : null}
                  <td
                    className={cx(
                      "border border-[var(--border)] px-2 py-1 text-sm",
                      CHECKLIST_QUESTION_CELL_CLASS,
                    )}
                  >
                    {q.questionText || "—"}
                  </td>
                  <td className="border border-[var(--border)] px-2 py-1 text-right tabular-nums font-semibold">
                    {answer.approvedScore}
                  </td>
                  <td className="border border-[var(--border)] px-1 py-1">
                    <input
                      className="input w-20"
                      type="number"
                      min={0}
                      value={received}
                      disabled={locked}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (Number.isNaN(value)) return;
                        setDraft(answer.id, { receivedScore: value });
                      }}
                    />
                  </td>
                  <td className="border border-[var(--border)] px-2 py-1 text-center">
                    <input
                      type="checkbox"
                      checked={applicable}
                      disabled={locked}
                      onChange={(event) => {
                        setDraft(answer.id, {
                          isApplicable: event.target.checked,
                        });
                      }}
                    />
                  </td>
                  <td className="border border-[var(--border)] px-1 py-1">
                    <StatusBadge
                      tone={
                        liveStatus === "pass"
                          ? "ok"
                          : liveStatus === "fail"
                            ? "danger"
                            : liveStatus === "partial"
                              ? "warn"
                              : "neutral"
                      }
                    >
                      {labelOf(COMPLIANCE_STATUS_LABELS, liveStatus)}
                    </StatusBadge>
                  </td>
                </tr>
              );
            })}
            <tr className={CHECKLIST_TOTAL_ROW_CLASS}>
              <td
                colSpan={3}
                className="border border-[var(--border)] px-2 py-2"
              >
                Нийт оноо
              </td>
              <td className="border border-[var(--border)] px-2 py-2 text-right tabular-nums">
                {grandApproved}
              </td>
              <td className="border border-[var(--border)] px-2 py-2 text-right tabular-nums">
                {grandReceived}
              </td>
              <td colSpan={2} className="border border-[var(--border)]" />
            </tr>
          </tbody>
        </table>
      </TableScroll>
    </div>
  );
}
