/**
 * Excel-aligned ХШ хуудас row model helpers.
 * Columns: № | Хууль тогтоомж… | Асуултууд | Батлагдсан оноо (+ run score cols).
 */

import type {
  InspectionTemplateQuestion,
  InspectionTemplateSection,
} from "@/lib/types";

export const CHECKLIST_SHEET_HEADERS = {
  no: "№",
  legal: "Хууль тогтоомж, дүрэм, журам, стандартын нэр, зүйл, заалт",
  question: "Асуултууд",
  approved: "Батлагдсан оноо",
  received: "Авсан",
  applicable: "Хамааралтай",
  status: "Төлөв",
} as const;

export const CHECKLIST_SECTION_ROW_CLASS =
  "bg-[#C5E0B4] text-[var(--fg)] dark:bg-emerald-900/50";
export const CHECKLIST_HEADER_ROW_CLASS =
  "bg-[#F8CBAD] text-[var(--fg)] dark:bg-orange-900/40";
export const CHECKLIST_TOTAL_ROW_CLASS =
  "bg-[#C5E0B4] font-semibold text-[var(--fg)] dark:bg-emerald-900/50";
export const CHECKLIST_QUESTION_CELL_CLASS =
  "bg-[#DEEBF7]/40 dark:bg-sky-950/20";

export type ChecklistSheetRow =
  | { kind: "section"; section: InspectionTemplateSection }
  | { kind: "question"; question: InspectionTemplateQuestion };

/** Interleave sections + questions like the Excel sheet. */
export function buildChecklistSheetRows(
  sections: InspectionTemplateSection[],
  questions: InspectionTemplateQuestion[],
): ChecklistSheetRow[] {
  const secs = [...sections].sort((a, b) => a.orderIndex - b.orderIndex);
  const qs = [...questions]
    .filter((q) => q.active !== false)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const used = new Set<string>();
  const rows: ChecklistSheetRow[] = [];

  // Prefer shared orderIndex space when sections and questions overlap in range.
  const allHaveDistinctOrder =
    secs.length > 0 &&
    qs.length > 0 &&
    new Set([...secs, ...qs].map((r) => r.orderIndex)).size ===
      secs.length + qs.length;

  if (allHaveDistinctOrder) {
    const mixed: Array<
      | { kind: "section"; orderIndex: number; section: InspectionTemplateSection }
      | {
          kind: "question";
          orderIndex: number;
          question: InspectionTemplateQuestion;
        }
    > = [
      ...secs.map((section) => ({
        kind: "section" as const,
        orderIndex: section.orderIndex,
        section,
      })),
      ...qs.map((question) => ({
        kind: "question" as const,
        orderIndex: question.orderIndex,
        question,
      })),
    ].sort((a, b) => a.orderIndex - b.orderIndex);
    return mixed.map((row) =>
      row.kind === "section"
        ? { kind: "section", section: row.section }
        : { kind: "question", question: row.question },
    );
  }

  for (const section of secs) {
    rows.push({ kind: "section", section });
    for (const q of qs.filter((q) => q.sectionId === section.id)) {
      rows.push({ kind: "question", question: q });
      used.add(q.id);
    }
  }
  for (const q of qs.filter((q) => !used.has(q.id))) {
    rows.push({ kind: "question", question: q });
  }
  return rows;
}

export type LegalMergeMeta = {
  /** First question id in the merge block */
  anchorQuestionId: string;
  rowSpan: number;
  /** True when this question is not the anchor (cell should be skipped) */
  skip: boolean;
};

/** Compute vertical merge spans for legal column (consecutive same group id). */
export function legalMergeMetaByQuestionId(
  rows: ChecklistSheetRow[],
): Map<string, LegalMergeMeta> {
  const map = new Map<string, LegalMergeMeta>();

  let i = 0;
  while (i < rows.length) {
    const row = rows[i]!;
    if (row.kind !== "question") {
      i += 1;
      continue;
    }
    const q = row.question;
    const groupId = q.legalMergeGroupId?.trim() || null;
    if (!groupId) {
      map.set(q.id, {
        anchorQuestionId: q.id,
        rowSpan: 1,
        skip: false,
      });
      i += 1;
      continue;
    }
    // Only merge across adjacent question rows (no section between).
    let j = i + 1;
    while (j < rows.length && rows[j]!.kind === "question") {
      const next = (rows[j] as Extract<ChecklistSheetRow, { kind: "question" }>)
        .question;
      if ((next.legalMergeGroupId?.trim() || null) !== groupId) break;
      j += 1;
    }
    const span = j - i;
    for (let k = i; k < j; k++) {
      const id = (rows[k] as Extract<ChecklistSheetRow, { kind: "question" }>)
        .question.id;
      map.set(id, {
        anchorQuestionId: q.id,
        rowSpan: span,
        skip: k !== i,
      });
    }
    i = j;
  }
  return map;
}

export function sectionApprovedTotal(
  sectionId: string,
  questions: InspectionTemplateQuestion[],
): number {
  return questions
    .filter((q) => q.sectionId === sectionId && q.active !== false)
    .reduce((sum, q) => sum + (Number(q.approvedScore) || 0), 0);
}

export function grandApprovedTotal(
  questions: InspectionTemplateQuestion[],
): number {
  return questions
    .filter((q) => q.active !== false)
    .reduce((sum, q) => sum + (Number(q.approvedScore) || 0), 0);
}

export function autoNumberQuestions(
  questions: InspectionTemplateQuestion[],
): InspectionTemplateQuestion[] {
  let n = 0;
  return questions.map((q) => {
    if (q.active === false) return q;
    n += 1;
    return { ...q, questionNo: String(n) };
  });
}

/** Roman / title for new section — editor can edit freely. */
export function defaultSectionTitle(index: number): string {
  const romans = [
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
    "XIII",
    "XIV",
    "XV",
  ];
  const label = romans[index] ?? String(index + 1);
  return `${label} Шинэ хэсэг`;
}
