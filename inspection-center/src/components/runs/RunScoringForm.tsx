"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type {
  InspectionAnswer,
  InspectionTemplateQuestion,
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

type Row = {
  answer: InspectionAnswer;
  question: InspectionTemplateQuestion | undefined;
};

function toSaveStatus(runStatus: RunStatus): InspectionRunSaveStatus {
  if (runStatus === "submitted") return "completed";
  if (isInspectionRunSaveStatus(runStatus)) return runStatus;
  return "in_progress";
}

export function RunScoringForm({
  runId,
  runStatus,
  inspectionDate,
  dueDate,
  completedDate,
  rows,
  readOnly = false,
}: {
  runId: string;
  runStatus: RunStatus;
  inspectionDate: string;
  dueDate?: string | null;
  completedDate?: string | null;
  rows: Row[];
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

  async function saveAll() {
    if (readOnly) return;
    setMessage("");
    setBusy(true);
    const answers = rows.flatMap(({ answer }) => {
      const draft = drafts[answer.id];
      return draft ? [{ answerId: answer.id, ...draft }] : [];
    });
    const res = await fetch(`/api/runs/${runId}/answers`, {
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
      setMessage("Хадгалахад алдаа гарлаа");
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
    const res = await fetch(`/api/runs/${runId}/answers`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reset: true }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage("Дахин тохируулахад алдаа гарлаа");
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
          <select className="select min-w-48"
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
          <input className="input min-w-40"
            type="date"
            value={startedDate}
            disabled={locked}
            onChange={(event) => setStartedDate(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Дуусгах хугацаа</span>
          <input className="input min-w-40"
            type="date"
            value={finishDueDate}
            disabled={locked}
            onChange={(event) => setFinishDueDate(event.target.value)}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Дуусгасан хугацаа</span>
          <input className="input min-w-40"
            type="date"
            value={finishedDate}
            disabled={locked}
            onChange={(event) => setFinishedDate(event.target.value)}
          />
        </label>
        {!readOnly ? (
          <>
        <button
          type="button" className="btn btn-primary"
          disabled={locked}
          onClick={() => void saveAll()}>
          Хадгалах
        </button>
        <button
          type="button" className="btn"
          disabled={locked}
          onClick={() => void resetAnswers()}>
          Дахин тохируулах
        </button>
          </>
        ) : (
          <p className="text-xs text-[var(--muted)]">
            Зөвхөн харах эрх · засах боломжгүй
          </p>
        )}
      </div>
      <TableScroll size="md" maxHeightClass="max-h-[36rem]">
        <table>
          <thead>
            <tr>
              <th className="col-narrow-sm">№</th>
              <th className="col-text-primary">Асуулт</th>
              <th className="col-narrow-sm">Батлагдсан</th>
              <th className="col-narrow-sm">Авсан</th>
              <th className="col-narrow-sm">Хамааралтай</th>
              <th className="col-narrow">Төлөв</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ answer, question }) => (
              <tr key={answer.id}>
                <td className="col-narrow-sm tabular-nums font-medium">
                  {question?.questionNo ?? "—"}
                </td>
                <td
                  className="col-text-primary"
                  title={[question?.questionText, question?.legalReference]
                    .filter(Boolean)
                    .join(" — ")}
                >
                  <span className="cell-ellipsis text-sm">
                    {question?.questionText ?? "—"}
                  </span>
                </td>
                <td className="col-narrow-sm tabular-nums font-semibold">
                  {answer.approvedScore}
                </td>
                <td className="col-narrow-sm">
                  <input
                    className="input w-20"
                    type="number"
                    min={0}
                    value={drafts[answer.id]?.receivedScore ?? 0}
                    disabled={locked}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (Number.isNaN(value)) return;
                      setDraft(answer.id, { receivedScore: value });
                    }}
                  />
                </td>
                <td className="col-narrow-sm">
                  <input
                    type="checkbox"
                    checked={drafts[answer.id]?.isApplicable ?? true}
                    disabled={locked}
                    onChange={(event) => {
                      setDraft(answer.id, { isApplicable: event.target.checked });
                    }}
                  />
                </td>
                <td className="col-narrow">
                  <StatusBadge
                    tone={
                      answer.complianceStatus === "pass"
                        ? "ok"
                        : answer.complianceStatus === "fail"
                          ? "danger"
                          : answer.complianceStatus === "partial"
                            ? "warn"
                            : "neutral"
                    }
                  >
                    {labelOf(COMPLIANCE_STATUS_LABELS, answer.complianceStatus)}
                  </StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableScroll>
    </div>
  );
}
