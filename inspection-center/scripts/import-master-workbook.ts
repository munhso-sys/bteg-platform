#!/usr/bin/env npx tsx
/**
 * Import master inspection workbook sheets that are not checklist templates.
 *
 * Usage:
 *   npx tsx scripts/import-master-workbook.ts [path-to.xlsx]
 */
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";

const DEFAULT_WORKBOOK =
  "C:/Users/Owner/.openclaw/media/inbound/ХШ---3be8ab4c-7ae7-4737-94f6-e87c83633f3d.xlsx";

type Cell = string | number | boolean | Date | null | undefined;

function text(value: Cell): string {
  if (value == null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function numberValue(value: Cell): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const n = Number(String(value).replace(/%/g, "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function rowsFor(wb: XLSX.WorkBook, sheetName: string): Cell[][] {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<Cell[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
  });
}

function worksheetRange(wb: XLSX.WorkBook, sheetName: string) {
  const ref = wb.Sheets[sheetName]?.["!ref"];
  if (!ref) return { rows: 0, cols: 0 };
  const range = XLSX.utils.decode_range(ref);
  return {
    rows: range.e.r - range.s.r + 1,
    cols: range.e.c - range.s.c + 1,
  };
}

function importChecklistCatalog(rows: Cell[][]) {
  const records = [];
  let lastOrgUnit = "";

  for (let r = 2; r < rows.length; r += 1) {
    const row = rows[r] ?? [];
    const sequence = numberValue(row[0]);
    const department = text(row[1]);
    const orgUnit = text(row[2]) || lastOrgUnit;
    const code = text(row[3]);
    const title = text(row[4]).replace(/_/g, " ");

    if (text(row[2])) lastOrgUnit = text(row[2]);
    if (!sequence || !code || code === "0") continue;

    records.push({
      sequence,
      department,
      orgUnit,
      code,
      title,
      sourceSheetName: "ХШХ-1",
      sourceRow: r + 1,
    });
  }

  return records;
}

function importJointChecklist(rows: Cell[][]) {
  const records = [];
  let lastCategory = "";

  for (let r = 2; r < rows.length; r += 1) {
    const row = rows[r] ?? [];
    const sequence = numberValue(row[0]);
    const category = text(row[1]) || lastCategory;
    const item = text(row[2]);
    const score = numberValue(row[3]);

    if (text(row[1])) lastCategory = text(row[1]);
    if (!sequence || !item) continue;

    records.push({
      sequence,
      category,
      item,
      maxScore: 5,
      score,
      sourceSheetName: "ХШХамтарсан",
      sourceRow: r + 1,
    });
  }

  return records;
}

function importStateInspections(rows: Cell[][]) {
  const records = [];

  for (let r = 4; r < rows.length; r += 1) {
    const row = rows[r] ?? [];
    const sequence = numberValue(row[0]);
    const authority = text(row[1]);
    const checklistNumber = text(row[2]);
    const checklistName = text(row[3]).replace(/_/g, " ");

    if (!sequence || !authority || !checklistName) continue;

    records.push({
      sequence,
      authority,
      checklistNumber,
      checklistName,
      inspectionDate: text(row[4]),
      requiredScoreFormulaOrValue: text(row[5]),
      failedScore: numberValue(row[6]),
      riskPercentFormulaOrValue: text(row[7]),
      implementationFormulaOrValue: text(row[8]),
      violationCountFormulaOrValue: text(row[9]),
      executionStatus: text(row[10]),
      responsibleEmployee: text(row[11]),
      progressPercent: numberValue(row[12]),
      dueDate: text(row[13]),
      sourceSheetName: "ХШТөрийн",
      sourceRow: r + 1,
    });
  }

  return records;
}

function importNightInspectionQuestions(rows: Cell[][]) {
  const records = [];
  let currentArea = "";
  let currentSectionNo = "";
  let currentSectionTitle = "";

  for (let r = 1; r < rows.length; r += 1) {
    const row = rows[r] ?? [];
    const sequence = numberValue(row[8]);
    const area = text(row[9]);
    const sectionNo = text(row[10]);
    const sectionTitle = text(row[11]);
    const item = text(row[12]);
    const note = text(row[13]);

    if (area) currentArea = area;
    if (sectionNo && sectionTitle) {
      currentSectionNo = sectionNo;
      currentSectionTitle = sectionTitle;
    }
    if (!sequence || !item) continue;

    records.push({
      sequence,
      area: currentArea,
      sectionNo: currentSectionNo,
      sectionTitle: currentSectionTitle,
      item,
      note,
      sourceSheetName: "ХШШөнийн",
      sourceRow: r + 1,
    });
  }

  return records;
}

function main() {
  const workbookPath = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? DEFAULT_WORKBOOK;

  if (!fs.existsSync(workbookPath)) {
    console.error(`Workbook not found: ${workbookPath}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(workbookPath, { cellDates: true, raw: false });
  const sheets = wb.SheetNames.map((name) => ({
    name,
    ...worksheetRange(wb, name),
  }));

  const payload = {
    importedAt: new Date().toISOString(),
    workbookPath,
    sheetSummary: {
      total: sheets.length,
      sheets,
    },
    checklistCatalog: importChecklistCatalog(rowsFor(wb, "ХШХ-1")),
    jointInspectionItems: importJointChecklist(rowsFor(wb, "ХШХамтарсан")),
    stateInspectionRows: importStateInspections(rowsFor(wb, "ХШТөрийн")),
    nightInspectionItems: importNightInspectionQuestions(rowsFor(wb, "ХШШөнийн")),
  };

  const outDir = path.join(process.cwd(), "data");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "imported-master-sheets.json");
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), "utf8");

  console.log(`Workbook: ${workbookPath}`);
  console.log(`Sheets: ${sheets.length}`);
  for (const sheet of sheets) {
    console.log(`  ${sheet.name}: ${sheet.rows} rows x ${sheet.cols} cols`);
  }
  console.log(`Checklist catalog rows: ${payload.checklistCatalog.length}`);
  console.log(`Joint inspection items: ${payload.jointInspectionItems.length}`);
  console.log(`State inspection rows: ${payload.stateInspectionRows.length}`);
  console.log(`Night inspection items: ${payload.nightInspectionItems.length}`);
  console.log(`Wrote ${outFile}`);
}

main();
