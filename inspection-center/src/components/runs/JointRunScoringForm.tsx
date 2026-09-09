"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import { Camera, RotateCcw, Save, X } from "lucide-react";
import type {
  InspectionAnswer,
  InspectionPerformer,
  InspectionTemplateQuestion,
  JointUnitScope,
  RunStatus,
} from "@/lib/types";
import {
  COMPLIANCE_STATUS_LABELS,
  INSPECTION_RUN_SAVE_STATUS_OPTIONS,
  isInspectionRunSaveStatus,
  type InspectionRunSaveStatus,
} from "@/lib/types";
import { StatusBadge, TableScroll } from "@/components/ui/primitives";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { ConsolidatedViolationReport } from "@/components/runs/ConsolidatedViolationReport";

type Row = {
  answer: InspectionAnswer;
  question: InspectionTemplateQuestion | undefined;
};

type Draft = {
  isApplicable: boolean;
  receivedScore: number;
  comment: string;
  photoUrl: string | null;
  photoName: string | null;
};

type UnitOption = {
  key: string;
  label: string;
};

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const PHOTO_ACCEPT = "image/*,image/heic,image/heif,.heic,.heif";
const PHOTO_MAX_EDGE = 1600;
const PHOTO_JPEG_QUALITY = 0.82;

const EMPTY_PERFORMER: InspectionPerformer = { name: "", position: "" };

async function fileToCompressedDataUrl(file: File): Promise<{
  dataUrl: string;
  name: string;
}> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () =>
        reject(new Error("Зургийг уншиж чадсангүй (HEIC/формат)."));
      el.src = objectUrl;
    });

    const scale = Math.min(
      1,
      PHOTO_MAX_EDGE / Math.max(img.naturalWidth || 1, img.naturalHeight || 1),
    );
    const width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
    const height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas бэлэн биш");
    ctx.drawImage(img, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", PHOTO_JPEG_QUALITY);
    const approxBytes = Math.ceil(((dataUrl.length - 22) * 3) / 4);
    if (approxBytes > MAX_PHOTO_BYTES) {
      throw new Error("Зураг 2MB-аас бага байх ёстой (шахалтын дараа)");
    }
    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return { dataUrl, name: `${base}.jpg` };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function normalizePerformers(
  performers: InspectionPerformer[] | undefined,
): InspectionPerformer[] {
  const cleaned = (performers ?? [])
    .map((row) => ({
      name: row.name?.trim() ?? "",
      position: row.position?.trim() ?? "",
    }))
    .filter((row) => row.name || row.position);
  if (cleaned.length === 0) {
    return [
      { ...EMPTY_PERFORMER },
      { ...EMPTY_PERFORMER },
      { ...EMPTY_PERFORMER },
      { ...EMPTY_PERFORMER },
    ];
  }
  return cleaned;
}

function toSaveStatus(runStatus: RunStatus): InspectionRunSaveStatus {
  if (runStatus === "submitted") return "completed";
  if (isInspectionRunSaveStatus(runStatus)) return runStatus;
  return "in_progress";
}

function emptyDrafts(rows: Row[]): Record<string, Draft> {
  return Object.fromEntries(
    rows.map(({ answer }) => [
      answer.id,
      {
        isApplicable: true,
        receivedScore: 0,
        comment: "",
        photoUrl: null,
        photoName: null,
      },
    ]),
  );
}

function draftsFromScope(
  rows: Row[],
  scope: JointUnitScope | undefined,
): Record<string, Draft> {
  const base = emptyDrafts(rows);
  if (!scope) return base;
  for (const { answer } of rows) {
    const saved = scope.answers[answer.id];
    if (!saved) continue;
    base[answer.id] = {
      isApplicable: saved.isApplicable,
      receivedScore: saved.receivedScore,
      comment: saved.comment ?? "",
      photoUrl: saved.photoUrl ?? null,
      photoName: saved.photoName ?? null,
    };
  }
  return base;
}

function unitTabClass(state: "active" | "saved" | "idle") {
  if (state === "active") {
    return "border-[var(--brand)] bg-[var(--brand)] text-white shadow-sm";
  }
  if (state === "saved") {
    return "border-emerald-600 bg-emerald-600 text-white";
  }
  // Not inspected / not saved yet
  return "border-dashed border-[var(--border)] bg-transparent text-[var(--muted)] hover:border-[var(--fg)] hover:bg-[var(--surface-muted)] hover:text-[var(--fg)]";
}

export function JointRunScoringForm({
  runId,
  runTitle,
  runStatus,
  inspectionDate,
  inspectedByOrg,
  dueDate,
  completedDate,
  rows,
  units,
  initialScopes,
  initialActiveUnitKey,
  initialPerformers,
  unitGroupLabel = "Алба / хэсэг / байршил",
  readOnly = false,
  inspectionType,
}: {
  runId: string;
  runTitle: string;
  runStatus: RunStatus;
  inspectionDate: string;
  inspectedByOrg?: string;
  dueDate?: string | null;
  completedDate?: string | null;
  rows: Row[];
  units: UnitOption[];
  initialScopes: JointUnitScope[];
  initialActiveUnitKey?: string | null;
  initialPerformers?: InspectionPerformer[];
  unitGroupLabel?: string;
  readOnly?: boolean;
  inspectionType?: "JOINT_INSPECTION" | "NIGHT_INSPECTION";
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
  const [scopes, setScopes] = useState<JointUnitScope[]>(initialScopes);
  const [activeUnitKey, setActiveUnitKey] = useState(
    () =>
      initialActiveUnitKey ||
      initialScopes.find((scope) => !scope.saved)?.unitKey ||
      units[0]?.key ||
      "",
  );
  const [draftsByUnit, setDraftsByUnit] = useState<
    Record<string, Record<string, Draft>>
  >(() => {
    const map: Record<string, Record<string, Draft>> = {};
    for (const unit of units) {
      const scope = initialScopes.find((item) => item.unitKey === unit.key);
      map[unit.key] = draftsFromScope(rows, scope);
    }
    return map;
  });
  const [performers, setPerformers] = useState<InspectionPerformer[]>(() =>
    normalizePerformers(initialPerformers),
  );
  const photoInputRef = useRef<HTMLInputElement>(null);
  const photoTargetRef = useRef<string | null>(null);
  const locked = pending || busy || readOnly;

  const activeUnit = units.find((unit) => unit.key === activeUnitKey) ?? units[0];
  const drafts = activeUnit ? draftsByUnit[activeUnit.key] ?? emptyDrafts(rows) : {};

  const savedKeys = useMemo(
    () => new Set(scopes.filter((scope) => scope.saved).map((scope) => scope.unitKey)),
    [scopes],
  );

  const unitExportMeta = useMemo(() => {
    const filled = performers.filter((row) => row.name || row.position);
    const rowsMeta: string[][] = [
      ["Хяналт шалгалт", runTitle],
      ["Байгууллага", inspectedByOrg || ""],
      [unitGroupLabel, activeUnit?.label || ""],
      ["Огноо", startedDate],
      ["Дуусгах хугацаа", finishDueDate || ""],
      ["Дуусгасан хугацаа", finishedDate || ""],
      [],
      ["Гүйцэтгэсэн ажилтан"],
      ["Нэр", "Албан тушаал"],
    ];
    if (filled.length === 0) {
      rowsMeta.push(["", ""]);
    } else {
      for (const row of filled) {
        rowsMeta.push([row.name, row.position]);
      }
    }
    return rowsMeta;
  }, [
    performers,
    runTitle,
    inspectedByOrg,
    unitGroupLabel,
    activeUnit?.label,
    startedDate,
    finishDueDate,
    finishedDate,
  ]);

  function setPerformer(
    index: number,
    patch: Partial<InspectionPerformer>,
  ) {
    setPerformers((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  }

  function addPerformer() {
    setPerformers((current) => [...current, { ...EMPTY_PERFORMER }]);
  }

  function removePerformer(index: number) {
    setPerformers((current) =>
      current.length <= 1
        ? [{ ...EMPTY_PERFORMER }]
        : current.filter((_, rowIndex) => rowIndex !== index),
    );
  }

  function setDraft(answerId: string, patch: Partial<Draft>) {
    if (!activeUnit) return;
    setDraftsByUnit((current) => {
      const unitDrafts = current[activeUnit.key] ?? emptyDrafts(rows);
      return {
        ...current,
        [activeUnit.key]: {
          ...unitDrafts,
          [answerId]: {
            isApplicable:
              patch.isApplicable ?? unitDrafts[answerId]?.isApplicable ?? true,
            receivedScore:
              patch.receivedScore ?? unitDrafts[answerId]?.receivedScore ?? 0,
            comment: patch.comment ?? unitDrafts[answerId]?.comment ?? "",
            photoUrl:
              patch.photoUrl !== undefined
                ? patch.photoUrl
                : (unitDrafts[answerId]?.photoUrl ?? null),
            photoName:
              patch.photoName !== undefined
                ? patch.photoName
                : (unitDrafts[answerId]?.photoName ?? null),
          },
        },
      };
    });
  }

  function pickPhoto(answerId: string) {
    const input = photoInputRef.current;
    if (!input || locked) return;
    photoTargetRef.current = answerId;
    input.value = "";
    input.click();
  }

  async function onPhotoSelected(fileList: FileList | null) {
    const answerId = photoTargetRef.current;
    photoTargetRef.current = null;
    const file = fileList?.[0];
    if (!answerId || !file) return;

    setMessage("Зураг бэлдэж байна…");
    try {
      // Prefer compress path (mobile camera / HEIC). Fall back to raw FileReader
      // when the browser cannot decode the image (rare desktop formats).
      try {
        const { dataUrl, name } = await fileToCompressedDataUrl(file);
        setDraft(answerId, { photoUrl: dataUrl, photoName: name });
        setMessage("");
        return;
      } catch (compressError) {
        if (file.size > MAX_PHOTO_BYTES) {
          setMessage(
            compressError instanceof Error
              ? compressError.message
              : "Зураг 2MB-аас бага байх ёстой",
          );
          return;
        }
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result =
              typeof reader.result === "string" ? reader.result : null;
            if (!result) reject(new Error("Зураг уншигдсангүй"));
            else resolve(result);
          };
          reader.onerror = () => reject(new Error("Зураг уншигдсангүй"));
          reader.readAsDataURL(file);
        });
        setDraft(answerId, { photoUrl: dataUrl, photoName: file.name });
        setMessage("");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Зураг оруулахад алдаа");
    }
  }

  function selectUnit(unitKey: string) {
    setActiveUnitKey(unitKey);
    setMessage("");
  }

  async function saveAll() {
    if (readOnly || !activeUnit) return;
    setMessage("");
    setBusy(true);
    const unitDrafts = draftsByUnit[activeUnit.key] ?? emptyDrafts(rows);
    const answers = rows.map(({ answer }) => {
      const draft = unitDrafts[answer.id];
      return {
        answerId: answer.id,
        isApplicable: draft?.isApplicable ?? true,
        receivedScore: draft?.receivedScore ?? 0,
        comment: draft?.comment ?? "",
        photoUrl: draft?.photoUrl ?? null,
        photoName: draft?.photoName ?? null,
      };
    });
    const res = await fetch(`/api/runs/${runId}/answers`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        answers,
        jointUnitKey: activeUnit.key,
        jointUnitLabel: activeUnit.label,
        status,
        inspectionDate: startedDate,
        dueDate: finishDueDate || null,
        completedDate: finishedDate || null,
        performers: performers
          .map((row) => ({
            name: row.name.trim(),
            position: row.position.trim(),
          }))
          .filter((row) => row.name || row.position),
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

    setScopes((current) => {
      const nextScope: JointUnitScope = {
        unitKey: activeUnit.key,
        label: activeUnit.label,
        saved: true,
        savedAt: new Date().toISOString(),
        answers: Object.fromEntries(
          answers.map((row) => [
            row.answerId,
            {
              isApplicable: row.isApplicable,
              receivedScore: row.receivedScore,
              comment: row.comment,
              photoUrl: row.photoUrl,
              photoName: row.photoName,
            },
          ]),
        ),
      };
      return current.some((scope) => scope.unitKey === activeUnit.key)
        ? current.map((scope) =>
            scope.unitKey === activeUnit.key ? nextScope : scope,
          )
        : [...current, nextScope];
    });

    setMessage(
      `${activeUnit.label} хадгаллаа. Нийт ${findingCount} зөрчил, ${actionCount} засах арга хэмжээ шинэчлэгдлээ.`,
    );
    startTransition(() => router.refresh());
  }

  async function resetActiveUnit() {
    if (!activeUnit) return;
    setMessage("");
    setDraftsByUnit((current) => ({
      ...current,
      [activeUnit.key]: emptyDrafts(rows),
    }));
    setMessage(`${activeUnit.label} дахин тохирууллаа (хадгалаагүй)`);
  }

  return (
    <div>
      <input
        ref={photoInputRef}
        type="file"
        accept={PHOTO_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          void onPhotoSelected(event.target.files);
        }}
      />
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
          className="btn btn-primary p-2"
          disabled={locked || !activeUnit}
          onClick={() => void saveAll()}
          aria-label="Хадгалах"
          title="Хадгалах"
        >
          <Save aria-hidden="true" className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="btn p-2"
          disabled={locked || !activeUnit}
          onClick={() => void resetActiveUnit()}
          aria-label="Дахин тохируулах"
          title="Дахин тохируулах"
        >
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
        </button>
          </>
        ) : (
          <span className="text-xs text-[var(--muted)]">Зөвхөн харах</span>
        )}
        <ExportButtons
          tableId={`run-scoring-table-${runId}`}
          filename={`hsh-${runId.slice(0, 8)}-${activeUnit?.key || "export"}`}
          excelLabel="Excel"
          pdfLabel="PDF"
          pdfPrintMode="unit-scoring"
          pdfTitle={`${activeUnit?.label || "Хэсэг"}-ийн ХШ хуудсыг PDF болгон хадгалах`}
          metaRows={unitExportMeta}
        />
      </div>

      <div className="mb-3 space-y-2 print:hidden">
        <div className="flex flex-wrap gap-1.5">
          {units.map((unit) => {
            const state =
              unit.key === activeUnitKey
                ? "active"
                : savedKeys.has(unit.key)
                  ? "saved"
                  : "idle";
            return (
              <button
                key={unit.key}
                type="button"
                disabled={locked}
                className={`rounded border px-2.5 py-1 text-xs font-semibold transition ${unitTabClass(state)}`}
                onClick={() => selectUnit(unit.key)}
              >
                {unit.label}
              </button>
            );
          })}
        </div>
        {activeUnit ? (
          <div className="text-xs text-[var(--muted)]">
            Одоо бөглөж буй:{" "}
            <span className="font-semibold text-[var(--fg)]">
              {activeUnit.label}
            </span>
            {savedKeys.has(activeUnit.key) ? " · хадгалсан" : " · хадгалаагүй"}
          </div>
        ) : null}
      </div>

      <div className="unit-scoring-print space-y-3">
        <header className="space-y-2 border border-[var(--border)] bg-slate-50 p-3 text-sm">
          <div className="text-center text-base font-semibold">
            Хэсгийн хяналт шалгалтын хуудас
          </div>
          <div className="grid gap-1 text-xs sm:grid-cols-2">
            <div>
              <span className="font-medium">Хяналт шалгалт: </span>
              {runTitle}
            </div>
            <div>
              <span className="font-medium">Огноо: </span>
              {startedDate || "—"}
            </div>
            <div>
              <span className="font-medium">Байгууллага: </span>
              {inspectedByOrg || "—"}
            </div>
            <div>
              <span className="font-medium">{unitGroupLabel}: </span>
              {activeUnit?.label || "—"}
            </div>
            {finishDueDate ? (
              <div>
                <span className="font-medium">Дуусгах хугацаа: </span>
                {finishDueDate}
              </div>
            ) : null}
            {finishedDate ? (
              <div>
                <span className="font-medium">Дуусгасан: </span>
                {finishedDate}
              </div>
            ) : null}
          </div>
        </header>

        <TableScroll size="md" maxHeightClass="max-h-[36rem]">
          <table id={`run-scoring-table-${runId}`}>
          <thead>
            <tr>
              <th className="col-narrow-sm">№</th>
              <th className="col-text-primary">Асуулт</th>
              <th className="col-narrow-sm">Батлагдсан</th>
              <th className="col-narrow-sm">Авсан</th>
              <th className="col-narrow-sm">Хамааралтай</th>
              <th className="col-narrow">Төлөв</th>
              <th className="col-narrow print:hidden">Зураг</th>
              <th className="min-w-[10rem]">Тайлбар</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ answer, question }) => {
              const draft = drafts[answer.id];
              const received = draft?.receivedScore ?? 0;
              const applicable = draft?.isApplicable ?? true;
              const hasPhoto = Boolean(draft?.photoUrl);
              const tone =
                !applicable
                  ? "neutral"
                  : received <= 0
                    ? "ok"
                    : received >= answer.approvedScore
                      ? "danger"
                      : "warn";
              const statusLabel = !applicable
                ? COMPLIANCE_STATUS_LABELS.not_applicable
                : received <= 0
                  ? COMPLIANCE_STATUS_LABELS.pass
                  : received >= answer.approvedScore
                    ? COMPLIANCE_STATUS_LABELS.fail
                    : COMPLIANCE_STATUS_LABELS.partial;

              return (
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
                      value={received}
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
                      checked={applicable}
                      disabled={locked}
                      onChange={(event) => {
                        setDraft(answer.id, {
                          isApplicable: event.target.checked,
                        });
                      }}
                    />
                  </td>
                  <td className="col-narrow">
                    <StatusBadge tone={tone}>{statusLabel}</StatusBadge>
                  </td>
                  <td className="w-12 align-middle print:hidden">
                    <div className="flex flex-col items-start gap-1">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className={`btn p-1.5 ${hasPhoto ? "border-[var(--brand)] text-[var(--brand-dark)]" : ""}`}
                          disabled={locked}
                          aria-label="Зураг оруулах"
                          title={
                            hasPhoto
                              ? draft?.photoName || "Зураг солих"
                              : "Зураг оруулах"
                          }
                          onClick={() => pickPhoto(answer.id)}
                        >
                          <Camera aria-hidden="true" className="h-4 w-4" />
                        </button>
                        {hasPhoto ? (
                          <button
                            type="button"
                            className="btn p-1 text-red-700 hover:bg-red-50"
                            disabled={locked}
                            aria-label="Зураг устгах"
                            title="Зураг устгах"
                            onClick={() =>
                              setDraft(answer.id, {
                                photoUrl: null,
                                photoName: null,
                              })
                            }
                          >
                            <X aria-hidden="true" className="h-3.5 w-3.5" />
                          </button>
                        ) : null}
                      </div>
                      {hasPhoto ? (
                        <span className="text-[10px] text-[var(--muted)]">
                          Зурагтай
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="min-w-[10rem]">
                    <input
                      className="input w-full min-w-[8rem] text-sm"
                      placeholder="Тайлбар"
                      value={draft?.comment ?? ""}
                      disabled={locked}
                      onChange={(event) => {
                        setDraft(answer.id, { comment: event.target.value });
                      }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </TableScroll>

        <section className="space-y-2 border border-[var(--border)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-semibold">Гүйцэтгэсэн ажилтан</div>
            <button
              type="button"
              className="btn text-xs print:hidden"
              disabled={locked}
              onClick={addPerformer}
            >
              Нэр нэмэх
            </button>
          </div>
          <TableScroll size="sm" maxHeightClass="max-h-none">
            <table className="text-sm">
              <thead>
                <tr>
                  <th className="w-[42%]">Нэр</th>
                  <th className="w-[42%]">Албан тушаал</th>
                  <th className="w-16 print:hidden"></th>
                </tr>
              </thead>
              <tbody>
                {performers.map((row, index) => (
                  <tr key={`performer-${index}`}>
                    <td>
                      <input
                        className="input w-full text-sm"
                        value={row.name}
                        disabled={locked}
                        onChange={(event) =>
                          setPerformer(index, { name: event.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="input w-full text-sm"
                        value={row.position}
                        disabled={locked}
                        onChange={(event) =>
                          setPerformer(index, { position: event.target.value })
                        }
                      />
                    </td>
                    <td className="print:hidden">
                      <button
                        type="button"
                        className="btn p-1.5 text-red-700"
                        disabled={locked}
                        aria-label="Устгах"
                        title="Устгах"
                        onClick={() => removePerformer(index)}
                      >
                        <X aria-hidden="true" className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableScroll>
        </section>
      </div>

      <div className="mt-4">
        <ConsolidatedViolationReport
          runId={runId}
          runTitle={runTitle}
          inspectionDate={inspectionDate}
          inspectedByOrg={inspectedByOrg}
          performers={performers}
          scopes={scopes}
          rows={rows}
          units={units}
          inspectionType={inspectionType}
        />
      </div>
    </div>
  );
}
