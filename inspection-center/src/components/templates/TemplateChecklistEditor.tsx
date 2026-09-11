"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ChangeEvent,
  type TextareaHTMLAttributes,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Combine,
  FolderPlus,
  Plus,
  RotateCcw,
  Split,
  Trash2,
  Undo2,
} from "lucide-react";
import type {
  InspectionTemplateQuestion,
  InspectionTemplateSection,
} from "@/lib/types";
import {
  CHECKLIST_HEADER_ROW_CLASS,
  CHECKLIST_QUESTION_CELL_CLASS,
  CHECKLIST_SECTION_ROW_CLASS,
  CHECKLIST_SHEET_HEADERS,
  CHECKLIST_TOTAL_ROW_CLASS,
  buildChecklistSheetRows,
  defaultSectionTitle,
  grandApprovedTotal,
  legalMergeMetaByQuestionId,
  sectionApprovedTotal,
  type ChecklistSheetRow,
} from "@/lib/checklist-sheet";
import { TableScroll } from "@/components/ui/primitives";

/** Textarea height follows content (compact empty / short rows). */
function AutoGrowTextarea({
  className,
  value,
  onChange,
  ...props
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
  value: string;
  onChange: (event: ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const fitHeight = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.max(el.scrollHeight, 28)}px`;
  };

  useLayoutEffect(() => {
    fitHeight();
  }, [value]);

  useEffect(() => {
    const onResize = () => fitHeight();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <textarea
      {...props}
      ref={ref}
      rows={1}
      value={value}
      className={cx("checklist-sheet-textarea", className)}
      onChange={(event) => {
        onChange(event);
        requestAnimationFrame(fitHeight);
      }}
    />
  );
}

type DraftSection = InspectionTemplateSection;
type DraftQuestion = InspectionTemplateQuestion;

type SheetSnapshot = {
  sections: DraftSection[];
  questions: DraftQuestion[];
};

type DeletedEntry = {
  row: ChecklistSheetRow;
  index: number;
  label: string;
};

const HISTORY_LIMIT = 40;

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function newId() {
  return crypto.randomUUID();
}

function cloneSnapshot(snap: SheetSnapshot): SheetSnapshot {
  return {
    sections: snap.sections.map((s) => ({ ...s })),
    questions: snap.questions.map((q) => ({ ...q })),
  };
}

function withAutoNumbers(questions: DraftQuestion[]): DraftQuestion[] {
  let n = 0;
  return questions.map((q) => {
    n += 1;
    return { ...q, questionNo: String(n) };
  });
}

function assignSectionIdsFromRows(
  rows: ChecklistSheetRow[],
): { sections: DraftSection[]; questions: DraftQuestion[] } {
  let currentSectionId: string | null = null;
  const sections: DraftSection[] = [];
  const questions: DraftQuestion[] = [];
  let order = 0;
  for (const row of rows) {
    order += 1;
    if (row.kind === "section") {
      currentSectionId = row.section.id;
      sections.push({ ...row.section, orderIndex: order });
    } else {
      questions.push({
        ...row.question,
        sectionId: currentSectionId,
        orderIndex: order,
      });
    }
  }
  return { sections, questions: withAutoNumbers(questions) };
}

function rowLabel(row: ChecklistSheetRow): string {
  if (row.kind === "section") {
    return `Хэсэг: ${row.section.title || "(хоосон)"}`;
  }
  const no = row.question.questionNo || "?";
  const text = (row.question.questionText || "").trim() || "(хоосон асуулт)";
  return `№${no} · ${text.slice(0, 48)}`;
}

export function TemplateChecklistEditor({
  templateId,
  templateTitle,
  initialSections,
  initialQuestions,
  saveSheet,
}: {
  templateId: string;
  templateTitle: string;
  initialSections: InspectionTemplateSection[];
  initialQuestions: InspectionTemplateQuestion[];
  saveSheet: (
    templateId: string,
    payload: {
      sections: Array<{
        id: string;
        title: string;
        sectionNo?: string;
        orderIndex: number;
      }>;
      questions: Array<{
        id: string;
        sectionId: string | null;
        questionNo: string;
        legalReference: string;
        legalMergeGroupId?: string | null;
        questionText: string;
        approvedScore: number;
        orderIndex: number;
        active?: boolean;
      }>;
    },
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sections, setSections] = useState(initialSections);
  const [questions, setQuestions] = useState(() =>
    withAutoNumbers(initialQuestions),
  );
  const [baseline, setBaseline] = useState<SheetSnapshot>(() =>
    cloneSnapshot({
      sections: initialSections,
      questions: withAutoNumbers(initialQuestions),
    }),
  );
  const [history, setHistory] = useState<SheetSnapshot[]>([]);
  const [deletedStack, setDeletedStack] = useState<DeletedEntry[]>([]);

  const rows = useMemo(
    () => buildChecklistSheetRows(sections, questions),
    [sections, questions],
  );
  const mergeMeta = useMemo(() => legalMergeMetaByQuestionId(rows), [rows]);
  const grandTotal = useMemo(
    () => grandApprovedTotal(questions),
    [questions],
  );

  function pushHistory() {
    setHistory((prev) => {
      const next = [
        ...prev,
        cloneSnapshot({ sections, questions }),
      ];
      return next.length > HISTORY_LIMIT
        ? next.slice(next.length - HISTORY_LIMIT)
        : next;
    });
  }

  function applySnapshot(snap: SheetSnapshot, note?: string) {
    setSections(snap.sections.map((s) => ({ ...s })));
    setQuestions(withAutoNumbers(snap.questions.map((q) => ({ ...q }))));
    if (note) setMessage(note);
  }

  function setRows(nextRows: ChecklistSheetRow[], recordHistory = true) {
    if (recordHistory) pushHistory();
    const next = assignSectionIdsFromRows(nextRows);
    setSections(next.sections);
    setQuestions(next.questions);
  }

  function undo() {
    if (history.length === 0) {
      setMessage("Буцаах өөрчлөлт байхгүй");
      return;
    }
    const snap = history[history.length - 1]!;
    setHistory((prev) => prev.slice(0, -1));
    applySnapshot(snap, "Өмнөх байдалд буцаалаа");
  }

  function restoreDeleted() {
    if (deletedStack.length === 0) {
      setMessage("Сэргээх устгасан мөр байхгүй");
      return;
    }
    const entry = deletedStack[deletedStack.length - 1]!;
    setDeletedStack((prev) => prev.slice(0, -1));
    pushHistory();
    const restored = [...rows];
    const insertAt = Math.min(Math.max(entry.index, 0), restored.length);
    restored.splice(insertAt, 0, entry.row);
    const packed = assignSectionIdsFromRows(restored);
    setSections(packed.sections);
    setQuestions(packed.questions);
    setMessage(`Сэргээлээ: ${entry.label}`);
  }

  function restoreBaseline() {
    if (
      !confirm(
        "Сүүлийн хадгалсан/ачаалсан байдалд бүх мөрийг сэргээх үү? Одоогийн хадгалаагүй өөрчлөлт устана.",
      )
    ) {
      return;
    }
    pushHistory();
    applySnapshot(baseline, "Хадгалсан байдалд сэргээлээ");
  }

  function updateQuestion(
    id: string,
    patch: Partial<DraftQuestion>,
  ) {
    setQuestions((prev) =>
      withAutoNumbers(
        prev.map((q) => (q.id === id ? { ...q, ...patch } : q)),
      ),
    );
  }

  function updateSection(id: string, patch: Partial<DraftSection>) {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  }

  function insertQuestionAt(rowIndex: number) {
    const id = newId();
    const q: DraftQuestion = {
      id,
      templateId,
      sectionId: null,
      questionNo: "0",
      legalReference: "",
      legalMergeGroupId: null,
      questionText: "",
      approvedScore: 0,
      orderIndex: 0,
      active: true,
      sourceSheetName: "manual",
    };
    const next = [...rows];
    next.splice(rowIndex, 0, { kind: "question", question: q });
    setRows(next);
  }

  function insertSectionAt(rowIndex: number) {
    const id = newId();
    const sectionCount = sections.length;
    const s: DraftSection = {
      id,
      templateId,
      parentId: null,
      sectionNo: String(sectionCount + 1),
      title: defaultSectionTitle(sectionCount),
      orderIndex: 0,
    };
    const next = [...rows];
    next.splice(rowIndex, 0, { kind: "section", section: s });
    setRows(next);
  }

  function removeAt(rowIndex: number) {
    const removed = rows[rowIndex];
    if (!removed) return;
    setDeletedStack((prev) => [
      ...prev.slice(-(HISTORY_LIMIT - 1)),
      {
        row:
          removed.kind === "section"
            ? { kind: "section", section: { ...removed.section } }
            : { kind: "question", question: { ...removed.question } },
        index: rowIndex,
        label: rowLabel(removed),
      },
    ]);
    const next = rows.filter((_, i) => i !== rowIndex);
    setRows(next);
    setMessage(`Устгалаа · Буцаах / Сэргээх боломжтой`);
  }

  function moveRow(rowIndex: number, dir: -1 | 1) {
    const target = rowIndex + dir;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    const tmp = next[rowIndex]!;
    next[rowIndex] = next[target]!;
    next[target] = tmp;
    setRows(next);
  }

  function mergeLegalWithNext(questionId: string) {
    const qRows = rows.filter((r) => r.kind === "question");
    const idx = qRows.findIndex((r) => r.question.id === questionId);
    if (idx < 0 || idx >= qRows.length - 1) return;
    const a = qRows[idx]!.question;
    const b = qRows[idx + 1]!.question;
    const groupId = a.legalMergeGroupId?.trim() || newId();
    const legal = a.legalReference || b.legalReference;
    pushHistory();
    setQuestions((prev) =>
      withAutoNumbers(
        prev.map((q) => {
          if (q.id === a.id) {
            return {
              ...q,
              legalMergeGroupId: groupId,
              legalReference: legal,
            };
          }
          if (q.id === b.id) {
            return {
              ...q,
              legalMergeGroupId: groupId,
              legalReference: legal,
            };
          }
          if (
            q.legalMergeGroupId &&
            (q.legalMergeGroupId === a.legalMergeGroupId ||
              q.legalMergeGroupId === b.legalMergeGroupId)
          ) {
            return {
              ...q,
              legalMergeGroupId: groupId,
              legalReference: legal,
            };
          }
          return q;
        }),
      ),
    );
  }

  function unmergeLegal(questionId: string) {
    const q = questions.find((row) => row.id === questionId);
    const groupId = q?.legalMergeGroupId?.trim();
    if (!groupId) return;
    pushHistory();
    setQuestions((prev) =>
      withAutoNumbers(
        prev.map((row) =>
          row.legalMergeGroupId === groupId
            ? { ...row, legalMergeGroupId: null }
            : row,
        ),
      ),
    );
  }

  async function save() {
    setMessage("");
    setBusy(true);
    const packed = assignSectionIdsFromRows(rows);
    const byId = new Map(packed.questions.map((q) => [q.id, q]));
    const sheetRows = buildChecklistSheetRows(
      packed.sections,
      packed.questions,
    );
    const meta = legalMergeMetaByQuestionId(sheetRows);
    for (const q of packed.questions) {
      const m = meta.get(q.id);
      if (!m || m.skip) continue;
      if (!q.legalMergeGroupId) continue;
      const legal = q.legalReference;
      for (const other of packed.questions) {
        if (other.legalMergeGroupId === q.legalMergeGroupId) {
          byId.set(other.id, { ...other, legalReference: legal });
        }
      }
    }
    const questionsOut = packed.questions.map((q) => byId.get(q.id) ?? q);

    try {
      const result = await saveSheet(templateId, {
        sections: packed.sections.map((s) => ({
          id: s.id,
          title: s.title,
          sectionNo: s.sectionNo,
          orderIndex: s.orderIndex,
        })),
        questions: questionsOut.map((q) => ({
          id: q.id,
          sectionId: q.sectionId,
          questionNo: q.questionNo,
          legalReference: q.legalReference,
          legalMergeGroupId: q.legalMergeGroupId ?? null,
          questionText: q.questionText,
          approvedScore: q.approvedScore,
          orderIndex: q.orderIndex,
          active: true,
        })),
      });
      if (!result.ok) {
        setMessage(result.error || "Алдаа");
        return;
      }
      const saved = cloneSnapshot({
        sections: packed.sections,
        questions: questionsOut,
      });
      setMessage("Хадгаллаа");
      setSections(packed.sections);
      setQuestions(questionsOut);
      setBaseline(saved);
      setHistory([]);
      setDeletedStack([]);
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (typing) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const locked = pending || busy;
  const canUndo = history.length > 0;
  const canRestoreDeleted = deletedStack.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn"
          disabled={locked}
          onClick={() => insertQuestionAt(rows.length)}
        >
          <Plus size={14} className="mr-1 inline" />
          Асуултын мөр
        </button>
        <button
          type="button"
          className="btn"
          disabled={locked}
          onClick={() => insertSectionAt(rows.length)}
        >
          <FolderPlus size={14} className="mr-1 inline" />
          Ногоон хэсэг
        </button>
        <button
          type="button"
          className="btn"
          disabled={locked || !canUndo}
          title="Ctrl+Z · Сүүлийн өөрчлөлтийг буцаах"
          onClick={() => undo()}
        >
          <Undo2 size={14} className="mr-1 inline" />
          Буцаах{canUndo ? ` (${history.length})` : ""}
        </button>
        <button
          type="button"
          className="btn"
          disabled={locked || !canRestoreDeleted}
          title="Устгасан мөрийг буцаан оруулах"
          onClick={() => restoreDeleted()}
        >
          <RotateCcw size={14} className="mr-1 inline" />
          Устгасныг сэргээх
          {canRestoreDeleted
            ? ` · ${deletedStack[deletedStack.length - 1]?.label.slice(0, 24)}`
            : ""}
        </button>
        <button
          type="button"
          className="btn"
          disabled={locked}
          title="Сүүлийн хадгалсан/ачаалсан байдалд бүхэлд нь сэргээх"
          onClick={() => restoreBaseline()}
        >
          <RotateCcw size={14} className="mr-1 inline" />
          Хадгалсан руу сэргээх
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={locked}
          onClick={() => void save()}
        >
          {busy ? "Хадгалж байна…" : "Хуудас хадгалах"}
        </button>
        {message ? (
          <span className="text-sm text-[var(--muted)]">{message}</span>
        ) : null}
      </div>

      <TableScroll
        size="lg"
        maxHeightClass="max-h-[40rem]"
        className="checklist-sheet-scroll rounded-md border border-[var(--border)]"
      >
        <table
          id="questions-table"
          className="checklist-sheet-table w-full text-sm"
        >
          <thead>
            <tr>
              <th
                colSpan={5}
                className={cx(
                  "border border-[var(--border)] px-2 py-2 text-left text-sm font-semibold",
                  CHECKLIST_HEADER_ROW_CLASS,
                )}
              >
                {templateTitle}
              </th>
            </tr>
            <tr className={CHECKLIST_HEADER_ROW_CLASS}>
              <th className="w-14 border border-[var(--border)] px-1 py-1.5">
                {CHECKLIST_SHEET_HEADERS.no}
              </th>
              <th className="min-w-[12rem] border border-[var(--border)] px-1 py-1.5">
                {CHECKLIST_SHEET_HEADERS.legal}
              </th>
              <th className="min-w-[14rem] border border-[var(--border)] px-1 py-1.5">
                {CHECKLIST_SHEET_HEADERS.question}
              </th>
              <th className="w-24 border border-[var(--border)] px-1 py-1.5">
                {CHECKLIST_SHEET_HEADERS.approved}
              </th>
              <th className="w-px min-w-[2.6rem] whitespace-nowrap border border-[var(--border)] px-0.5 py-1.5 text-[10px] lg:min-w-[3.7rem]">
                Үйлдэл
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              if (row.kind === "section") {
                const total = sectionApprovedTotal(row.section.id, questions);
                return (
                  <tr key={`s:${row.section.id}`} className={CHECKLIST_SECTION_ROW_CLASS}>
                    <td
                      colSpan={3}
                      className="border border-[var(--border)] px-2 py-1.5"
                    >
                      <input
                        className="input w-full border-0 bg-transparent font-semibold"
                        value={row.section.title}
                        disabled={locked}
                        onChange={(e) =>
                          updateSection(row.section.id, {
                            title: e.target.value,
                          })
                        }
                      />
                    </td>
                    <td className="border border-[var(--border)] px-2 py-1.5 text-right tabular-nums font-semibold">
                      {total}
                    </td>
                    <td className="w-px whitespace-nowrap border border-[var(--border)] px-0.5 py-0.5 align-top">
                      <RowActions
                        locked={locked}
                        onInsertQuestion={() => insertQuestionAt(rowIndex + 1)}
                        onInsertSection={() => insertSectionAt(rowIndex + 1)}
                        onUp={() => moveRow(rowIndex, -1)}
                        onDown={() => moveRow(rowIndex, 1)}
                        onRemove={() => removeAt(rowIndex)}
                      />
                    </td>
                  </tr>
                );
              }

              const q = row.question;
              const meta = mergeMeta.get(q.id);
              const showLegal = !meta?.skip;
              const rowSpan = meta?.rowSpan ?? 1;

              return (
                <tr key={`q:${q.id}`}>
                  <td className="border border-[var(--border)] px-2 py-1 text-center tabular-nums font-medium">
                    {q.questionNo}
                  </td>
                  {showLegal ? (
                    <td
                      rowSpan={rowSpan}
                      className={cx(
                        "checklist-legal-cell border border-[var(--border)] px-1 py-1 align-top",
                        rowSpan > 1 &&
                          "checklist-legal-cell--merged bg-[#FFF2CC]/60 dark:bg-amber-950/30",
                      )}
                    >
                      <div className="checklist-legal-sticky">
                        <AutoGrowTextarea
                          value={q.legalReference}
                          disabled={locked}
                          onChange={(e) =>
                            updateQuestion(q.id, {
                              legalReference: e.target.value,
                            })
                          }
                          placeholder="Хууль / заалт"
                        />
                      </div>
                    </td>
                  ) : null}
                  <td
                    className={cx(
                      "border border-[var(--border)] px-1 py-1",
                      CHECKLIST_QUESTION_CELL_CLASS,
                    )}
                  >
                    <AutoGrowTextarea
                      value={q.questionText}
                      disabled={locked}
                      onChange={(e) =>
                        updateQuestion(q.id, {
                          questionText: e.target.value,
                        })
                      }
                      placeholder="Асуулт"
                    />
                  </td>
                  <td className="border border-[var(--border)] px-1 py-1">
                    <input
                      className="input w-full tabular-nums"
                      type="number"
                      step="0.01"
                      min={0}
                      value={q.approvedScore}
                      disabled={locked}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isNaN(v)) return;
                        updateQuestion(q.id, { approvedScore: v });
                      }}
                    />
                  </td>
                  <td className="w-px whitespace-nowrap border border-[var(--border)] px-0.5 py-0.5 align-top">
                    <RowActions
                      locked={locked}
                      onInsertQuestion={() => insertQuestionAt(rowIndex + 1)}
                      onInsertSection={() => insertSectionAt(rowIndex + 1)}
                      onUp={() => moveRow(rowIndex, -1)}
                      onDown={() => moveRow(rowIndex, 1)}
                      onRemove={() => removeAt(rowIndex)}
                      onMergeLegal={() => mergeLegalWithNext(q.id)}
                      onUnmergeLegal={
                        q.legalMergeGroupId
                          ? () => unmergeLegal(q.id)
                          : undefined
                      }
                    />
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
                {grandTotal}
              </td>
              <td className="border border-[var(--border)]" />
            </tr>
          </tbody>
        </table>
      </TableScroll>
    </div>
  );
}

const ROW_TOOL_BTN =
  "checklist-row-tool inline-flex size-[18px] shrink-0 items-center justify-center rounded-[3px] border border-[var(--border)] bg-[var(--card)] p-0 leading-none text-[var(--fg)] hover:bg-[var(--surface-muted)] disabled:cursor-not-allowed disabled:opacity-40";

function RowActions({
  locked,
  onInsertQuestion,
  onInsertSection,
  onUp,
  onDown,
  onRemove,
  onMergeLegal,
  onUnmergeLegal,
}: {
  locked: boolean;
  onInsertQuestion: () => void;
  onInsertSection: () => void;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  onMergeLegal?: () => void;
  onUnmergeLegal?: () => void;
}) {
  return (
    <div
      className="checklist-row-tools"
      role="group"
      aria-label="Мөрийн үйлдлүүд"
    >
      <button
        type="button"
        className={ROW_TOOL_BTN}
        title="Доор асуулт оруулах"
        disabled={locked}
        onClick={onInsertQuestion}
      >
        <Plus size={11} strokeWidth={2.25} />
      </button>
      <button
        type="button"
        className={ROW_TOOL_BTN}
        title="Доор хэсэг оруулах"
        disabled={locked}
        onClick={onInsertSection}
      >
        <FolderPlus size={11} strokeWidth={2.25} />
      </button>
      <button
        type="button"
        className={ROW_TOOL_BTN}
        title="Дээш"
        disabled={locked}
        onClick={onUp}
      >
        <ArrowUp size={11} strokeWidth={2.25} />
      </button>
      <button
        type="button"
        className={ROW_TOOL_BTN}
        title="Доош"
        disabled={locked}
        onClick={onDown}
      >
        <ArrowDown size={11} strokeWidth={2.25} />
      </button>
      <button
        type="button"
        className={ROW_TOOL_BTN}
        title="Устгах"
        disabled={locked}
        onClick={onRemove}
      >
        <Trash2 size={11} strokeWidth={2.25} />
      </button>
      {onMergeLegal ? (
        <button
          type="button"
          className={ROW_TOOL_BTN}
          title="Доорх мөртэй хууль/заалт нэгтгэх"
          disabled={locked}
          onClick={onMergeLegal}
        >
          <Combine size={11} strokeWidth={2.25} />
        </button>
      ) : null}
      {onUnmergeLegal ? (
        <button
          type="button"
          className={ROW_TOOL_BTN}
          title="Нэгтгэлийг салгах"
          disabled={locked}
          onClick={onUnmergeLegal}
        >
          <Split size={11} strokeWidth={2.25} />
        </button>
      ) : null}
    </div>
  );
}
