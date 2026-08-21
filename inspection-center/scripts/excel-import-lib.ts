import * as XLSX from "xlsx";
import { randomUUID } from "crypto";
import type {
  InspectionTemplate,
  InspectionTemplateQuestion,
  InspectionTemplateSection,
} from "../src/lib/types";

export const CHECKLIST_SHEET_RE = /^\d+(\.\d+)*$/;

export interface WorkbookSheetInfo {
  name: string;
  hidden: boolean;
  index: number;
}

export interface ExtractedTemplateBundle {
  template: InspectionTemplate;
  sections: InspectionTemplateSection[];
  questions: InspectionTemplateQuestion[];
}

function cellStr(value: unknown): string {
  if (value == null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function toNumber(value: unknown): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value).replace(/%/g, "").replace(/,/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function colLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function listWorkbookSheets(
  workbookPath: string,
): WorkbookSheetInfo[] {
  const wb = XLSX.readFile(workbookPath, { bookSheets: true });
  // bookSheets:true only gives names — re-read with full book for Hidden flags
  const full = XLSX.readFile(workbookPath, { bookSheets: false });
  const meta = full.Workbook?.Sheets ?? [];
  return full.SheetNames.map((name, index) => {
    const m = meta.find((s) => s.name === name);
    const hidden = m?.Hidden === 1 || m?.Hidden === 2;
    return { name, hidden, index };
  });
}

export function isChecklistSheetName(name: string): boolean {
  return CHECKLIST_SHEET_RE.test(name.trim());
}

function parseTitle(row0: unknown[]): { code: string; title: string } {
  const b = cellStr(row0[1]);
  const a = cellStr(row0[0]);
  const raw = b || a;
  const match = raw.match(/№?\s*(\d+(?:\.\d+)*)\s*[.\-–]?\s*(.*)$/i);
  if (match) {
    return {
      code: match[1],
      title: match[2].replace(/^[\.\-–\s]+/, "").trim() || raw,
    };
  }
  return { code: "", title: raw || "Untitled checklist" };
}

function findHeaderRow(rows: unknown[][]): number {
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const a = cellStr(rows[i]?.[0]).toLowerCase();
    const b = cellStr(rows[i]?.[1]);
    const c = cellStr(rows[i]?.[2]);
    if (
      a === "№" ||
      a === "no" ||
      (b.includes("Хууль") && (c.includes("Асуулт") || c.includes("асуулт")))
    ) {
      return i;
    }
  }
  return 10; // Excel convention: questions start after rows 1-10 header
}

function approvedScoreFromRow(row: unknown[]): number {
  const passScore = toNumber(row[3]);
  const failScore = toNumber(row[4]);
  // Prefer non-compliance weight (col E); fallback to pass score
  if (failScore > 0) return failScore;
  if (passScore > 0) return passScore;
  return 0;
}

export function extractChecklistTemplate(
  workbookPath: string,
  sheetName: string,
  options?: { now?: string },
): ExtractedTemplateBundle {
  const wb = XLSX.readFile(workbookPath, { cellDates: true, raw: false });
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
  });

  const now = options?.now ?? new Date().toISOString();
  const { code: parsedCode, title } = parseTitle(rows[0] ?? []);
  // Prefer sheet name when it is already a checklist code (avoids 04.1.7 vs 4.1.7)
  const code = isChecklistSheetName(sheetName)
    ? sheetName.trim()
    : parsedCode || sheetName;

  const templateId = randomUUID();
  const template: InspectionTemplate = {
    id: templateId,
    code,
    title,
    category: inferCategory(code, title),
    sourceSheetName: sheetName,
    regulatorySource: undefined,
    active: true,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  const headerRow = findHeaderRow(rows);
  const dataStart = headerRow + 1;
  // Often a sub-header row follows (Шаардлага хангасан / хангаагүй)
  let start = dataStart;
  const maybeSub = cellStr(rows[dataStart]?.[3]).toLowerCase();
  if (
    maybeSub.includes("шаардлага") ||
    maybeSub.includes("хангасан") ||
    cellStr(rows[dataStart]?.[0]) === ""
  ) {
    // If first data-looking row is subheader or empty №, skip one
    if (
      maybeSub.includes("шаардлага") ||
      cellStr(rows[dataStart]?.[5]).toLowerCase().includes("хамааралтай")
    ) {
      start = dataStart + 1;
    }
  }

  const sections: InspectionTemplateSection[] = [];
  const questions: InspectionTemplateQuestion[] = [];
  let currentSectionId: string | null = null;
  let orderIndex = 0;
  let sectionOrder = 0;

  for (let r = start; r < rows.length; r++) {
    const row = rows[r] ?? [];
    const no = cellStr(row[0]);
    const legal = cellStr(row[1]);
    const questionText = cellStr(row[2]);
    const score = approvedScoreFromRow(row);

    if (!no && !legal && !questionText) continue;

    const isNumericNo = /^\d+(\.\d+)*$/.test(no);

    // Section header: non-numeric № cell with little/no question, or text-only first cell spanning
    if (no && !isNumericNo && !questionText) {
      sectionOrder += 1;
      const sectionId = randomUUID();
      sections.push({
        id: sectionId,
        templateId,
        parentId: null,
        sectionNo: String(sectionOrder),
        title: no,
        orderIndex: sectionOrder,
      });
      currentSectionId = sectionId;
      continue;
    }

    if (!isNumericNo && !questionText && legal) {
      // Rare: legal-only section-like rows
      continue;
    }

    if (!isNumericNo && !questionText) continue;

    orderIndex += 1;
    const qNo = isNumericNo ? no : String(orderIndex);
    questions.push({
      id: randomUUID(),
      templateId,
      sectionId: currentSectionId,
      questionNo: qNo,
      legalReference: legal,
      questionText: questionText || legal || `Question ${qNo}`,
      approvedScore: score,
      orderIndex,
      active: true,
      sourceSheetName: sheetName,
      sourceCellRef: `${colLetter(0)}${r + 1}:${colLetter(4)}${r + 1}`,
      rawText: [no, legal, questionText].filter(Boolean).join(" | "),
    });
  }

  return { template, sections, questions };
}

function inferCategory(code: string, title: string): string {
  const root = code.split(".")[0] || "";
  const map: Record<string, string> = {
    "1": "Байгаль орчин",
    "2": "Барилга",
    "4": "Тээвэр / авто зам",
    "5": "Шатахуун / худалдаа",
    "6": "Уул уурхай",
    "7": "Хөдөлмөр / ХАБ",
    "9": "Эрчим хүч",
    "10": "Байгаль орчин / цэвэрлэх",
    "11": "Мэдээлэл холбоо",
    "12": "Хэмжил зүй",
  };
  if (map[root]) return map[root];
  const t = title.toLowerCase();
  if (t.includes("уурхай")) return "Уул уурхай";
  if (t.includes("хөдөлмөр") || t.includes("хаб")) return "Хөдөлмөр / ХАБ";
  if (t.includes("шатахуун")) return "Шатахуун / худалдаа";
  return "Ерөнхий";
}

export function importVisibleChecklists(
  workbookPath: string,
  options?: { includeHidden?: boolean },
): {
  sheets: WorkbookSheetInfo[];
  bundles: ExtractedTemplateBundle[];
} {
  const sheets = listWorkbookSheets(workbookPath);
  const targets = sheets.filter((s) => {
    if (!isChecklistSheetName(s.name)) return false;
    if (s.hidden && !options?.includeHidden) return false;
    return true;
  });

  const bundles = targets.map((s) =>
    extractChecklistTemplate(workbookPath, s.name),
  );

  return { sheets, bundles };
}
