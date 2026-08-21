#!/usr/bin/env npx tsx
/**
 * Merge the document inspection workbook into data/imported-master-sheets.json.
 *
 * Usage:
 *   npx tsx scripts/import-document-inspection.ts [path-to.xlsx]
 */
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";

const DEFAULT_WORKBOOK =
  "C:/Users/Owner/.openclaw/media/inbound/document_inspection---da3cd14a-375a-44c8-bc94-8694c3319842.xlsx";

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

function importDocumentInspectionItems(rows: Cell[][], sourceSheetName: string) {
  const records = [];

  for (let r = 3; r < rows.length; r += 1) {
    const row = rows[r] ?? [];
    const sequence = numberValue(row[0]);
    const listItem = text(row[1]);

    if (!sequence || !listItem) continue;

    records.push({
      sequence,
      listItem,
      category: text(row[2]),
      responsibleDepartment: text(row[3]),
      responsiblePosition: text(row[4]),
      existsText: text(row[5]),
      dueOrLatestDate: text(row[6]),
      note: text(row[7]),
      additionalNote: text(row[8]),
      sourceSheetName,
      sourceRow: r + 1,
    });
  }

  return records;
}

function main() {
  const workbookPath =
    process.argv.slice(2).find((a) => !a.startsWith("--")) ?? DEFAULT_WORKBOOK;

  if (!fs.existsSync(workbookPath)) {
    console.error(`Workbook not found: ${workbookPath}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(workbookPath, { cellDates: true, raw: false });
  const sourceSheetName = wb.SheetNames[0];
  if (!sourceSheetName) {
    console.error("Workbook has no sheets");
    process.exit(1);
  }

  const outFile = path.join(process.cwd(), "data", "imported-master-sheets.json");
  const existing = fs.existsSync(outFile)
    ? JSON.parse(fs.readFileSync(outFile, "utf8"))
    : {
        checklistCatalog: [],
        jointInspectionItems: [],
        stateInspectionRows: [],
        nightInspectionItems: [],
      };

  const sheetInfo = {
    name: sourceSheetName,
    ...worksheetRange(wb, sourceSheetName),
  };
  const documentInspectionItems = importDocumentInspectionItems(
    rowsFor(wb, sourceSheetName),
    sourceSheetName,
  );

  const previousSheets = Array.isArray(existing.sheetSummary?.sheets)
    ? existing.sheetSummary.sheets.filter(
        (sheet: { name?: string }) => sheet.name !== sourceSheetName,
      )
    : [];

  const payload = {
    ...existing,
    importedAt: new Date().toISOString(),
    documentWorkbookPath: workbookPath,
    sheetSummary: {
      ...(existing.sheetSummary ?? {}),
      total: previousSheets.length + 1,
      sheets: [...previousSheets, sheetInfo],
    },
    documentInspectionItems,
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), "utf8");

  console.log(`Workbook: ${workbookPath}`);
  console.log(`Sheet: ${sourceSheetName}: ${sheetInfo.rows} rows x ${sheetInfo.cols} cols`);
  console.log(`Document inspection items: ${documentInspectionItems.length}`);
  console.log(`Wrote ${outFile}`);
}

main();
