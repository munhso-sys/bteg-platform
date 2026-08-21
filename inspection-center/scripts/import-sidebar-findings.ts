#!/usr/bin/env npx tsx
/**
 * Import the Findings sidebar indicators from the workbook HOME/ХШХ dashboard.
 *
 * The ХШХ sheet renders sections 4, 5, and 7 by formula:
 * - 4: ХШТөрийн rows via OFFSET controlled by ХШТөрийн!H4
 * - 5: ХШШөнийн month/category/top mismatch rows via ХШШөнийн!I2
 * - 7: ХШХамтарсан category/unit/mismatch rows via ХШХамтарсан!A95/A96
 */
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";

const DEFAULT_WORKBOOK =
  "C:/Users/Owner/.openclaw/media/inbound/TEST_2026-04-23---c681df84-7f14-477b-b352-a5b94766a6b7.xlsm";

type Cell = string | number | boolean | Date | null | undefined;

function text(value: Cell): string {
  if (value == null) return "";
  return String(value).replace(/\s+/g, " ").trim();
}

function numberValue(value: Cell): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value).replace(/%/g, "").replace(/,/g, "").trim();
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function percentValue(value: Cell): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return value > 1 ? value / 100 : value;
  const raw = String(value).trim();
  const n = Number(raw.replace("%", "").replace(",", ""));
  if (!Number.isFinite(n)) return null;
  return raw.includes("%") || n > 1 ? n / 100 : n;
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

function formulaFor(wb: XLSX.WorkBook, sheetName: string, cellRef: string) {
  return wb.Sheets[sheetName]?.[cellRef]?.f ?? null;
}

function importStateIndicators(rows: Cell[][]) {
  const records = [];

  for (let r = 4; r < rows.length; r += 1) {
    const row = rows[r] ?? [];
    const displayNo = numberValue(row[7]);
    const implementationPercent = percentValue(row[8]);
    const checklistName = text(row[9]).replace(/_/g, " ");

    if (!displayNo || !implementationPercent) continue;

    records.push({
      sourceRow: r + 1,
      sequence: numberValue(row[1]),
      authority: text(row[2]),
      inspectionCount: numberValue(row[6]),
      displayNo,
      implementationPercent,
      checklistName,
      inspectionDate: text(row[11]),
      responsibleEmployee: text(row[12]),
      progressPercent: percentValue(row[14]),
      riskPercent: percentValue(row[22]),
      violationCount: numberValue(row[24]),
    });
  }

  return records;
}

function importNightIndicators(rows: Cell[][]) {
  const monthly = [];
  for (let r = 6; r <= 11; r += 1) {
    const row = rows[r] ?? [];
    const label = text(row[1]);
    if (!label) continue;
    monthly.push({
      sourceRow: r + 1,
      monthRange: label,
      inspectionCount: numberValue(row[2]),
      violationCount: numberValue(row[3]),
      resolvedCount: numberValue(row[4]),
      resolvedPercent: percentValue(row[5]),
    });
  }

  const categories = [];
  for (let r = 13; r <= 14; r += 1) {
    const row = rows[r] ?? [];
    categories.push({
      sourceRow: r + 1,
      category: text(row[1]),
      violationCount: numberValue(row[3]),
      sharePercent: percentValue(row[5]),
    });
  }

  const mismatches = [];
  for (let r = 6; r <= 21; r += 1) {
    const row = rows[r] ?? [];
    const item = text(row[7]);
    if (!item) continue;
    mismatches.push({
      sourceRow: r + 1,
      item,
      count: numberValue(row[8]),
    });
  }

  return {
    selectedOffset: numberValue(rows[1]?.[8]) ?? 0,
    monthly,
    categories,
    mismatches,
    mismatchTotal: numberValue(rows[22]?.[8]),
  };
}

function importJointIndicators(rows: Cell[][]) {
  const categories = [];
  for (let r = 4; r <= 8; r += 1) {
    const row = rows[r] ?? [];
    const code = text(row[0]);
    const name = text(row[1]);
    if (!code && !name) continue;
    categories.push({
      sourceRow: r + 1,
      code,
      name,
      violationCount: numberValue(row[4]),
      sharePercent: percentValue(row[5]),
      resolvedCount: numberValue(row[6]),
      resolvedPercent: percentValue(row[7]),
    });
  }

  const units = [];
  for (let r = 46; r <= 61; r += 1) {
    const row = rows[r] ?? [];
    const unit = text(row[1]);
    if (!unit) continue;
    units.push({
      sourceRow: r + 1,
      unit,
      environmentCount: numberValue(row[2]),
      internalCount: numberValue(row[3]),
      safetyCount: numberValue(row[4]),
      hygieneCount: numberValue(row[5]),
      totalCount: numberValue(row[6]),
    });
  }

  const mismatches = [];
  for (let r = 96; r <= 106; r += 1) {
    const row = rows[r] ?? [];
    const item = text(row[1]);
    if (!item || item === "0") continue;
    mismatches.push({
      sourceRow: r + 1,
      item,
      count: numberValue(row[2]),
    });
  }

  return {
    selectedYear: text(rows[41]?.[7]) || text(rows[10]?.[2]),
    selectedCategoryCode: text(rows[42]?.[7]),
    unitOffset: numberValue(rows[95]?.[0]) ?? 0,
    mismatchOffset: numberValue(rows[94]?.[0]) ?? 0,
    categories,
    units,
    mismatches,
    totalCount: numberValue(rows[8]?.[4]),
    resolvedTotal: numberValue(rows[8]?.[6]),
    resolvedPercent: percentValue(rows[8]?.[7]),
  };
}

function main() {
  const workbookPath = process.argv.slice(2).find((a) => !a.startsWith("--")) ?? DEFAULT_WORKBOOK;
  if (!fs.existsSync(workbookPath)) {
    console.error(`Workbook not found: ${workbookPath}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(workbookPath, {
    cellDates: true,
    cellFormula: true,
    raw: false,
  });

  const payload = {
    importedAt: new Date().toISOString(),
    workbookPath,
    sourceSheetName: "ХШХ",
    sourceSections: {
      state: {
        windowNo: 4,
        title: "Төрийн байгууллагын хяналт шалгалт",
        sourceSheetName: "ХШТөрийн",
        filterCell: "ХШТөрийн!H4",
        formulas: {
          displayedNo: formulaFor(wb, "ХШХ", "Q31"),
          implementation: formulaFor(wb, "ХШХ", "R31"),
          checklistName: formulaFor(wb, "ХШХ", "S31"),
          inspectionDate: formulaFor(wb, "ХШХ", "U31"),
          violationCount: formulaFor(wb, "ХШХ", "V31"),
          riskPercent: formulaFor(wb, "ХШХ", "W31"),
        },
        totalChecklists: numberValue(rowsFor(wb, "ХШТөрийн")[3]?.[6]),
        selectedOffset: numberValue(rowsFor(wb, "ХШТөрийн")[3]?.[7]) ?? 0,
        rows: importStateIndicators(rowsFor(wb, "ХШТөрийн")),
      },
      night: {
        windowNo: 5,
        title: "Шөнийн хяналт шалгалт",
        sourceSheetName: "ХШШөнийн",
        filterCell: "ХШШөнийн!I2",
        formulas: {
          monthlyViolation: formulaFor(wb, "ХШХ", "AD31"),
          monthlyResolved: formulaFor(wb, "ХШХ", "AE31"),
          monthlyResolvedPercent: formulaFor(wb, "ХШХ", "AF31"),
          topMismatch: formulaFor(wb, "ХШХ", "AK31"),
          topMismatchCount: formulaFor(wb, "ХШХ", "AM31"),
        },
        ...importNightIndicators(rowsFor(wb, "ХШШөнийн")),
      },
      joint: {
        windowNo: 7,
        title: "Хамтарсан хяналт шалгалт",
        sourceSheetName: "ХШХамтарсан",
        filterCells: ["ХШХамтарсан!A95", "ХШХамтарсан!A96"],
        formulas: {
          categoryViolation: formulaFor(wb, "ХШХ", "AD47"),
          categoryShare: formulaFor(wb, "ХШХ", "AE47"),
          categoryResolvedPercent: formulaFor(wb, "ХШХ", "AF47"),
          unit: formulaFor(wb, "ХШХ", "AH45"),
          unitCount: formulaFor(wb, "ХШХ", "AI45"),
          mismatch: formulaFor(wb, "ХШХ", "AK45"),
          mismatchCount: formulaFor(wb, "ХШХ", "AM45"),
        },
        ...importJointIndicators(rowsFor(wb, "ХШХамтарсан")),
      },
    },
  };

  const outDir = path.join(process.cwd(), "data");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "sidebar-findings-indicators.json");
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), "utf8");

  console.log(`Workbook: ${workbookPath}`);
  console.log(`State rows: ${payload.sourceSections.state.rows.length}`);
  console.log(`Night monthly rows: ${payload.sourceSections.night.monthly.length}`);
  console.log(`Night mismatch rows: ${payload.sourceSections.night.mismatches.length}`);
  console.log(`Joint category rows: ${payload.sourceSections.joint.categories.length}`);
  console.log(`Joint unit rows: ${payload.sourceSections.joint.units.length}`);
  console.log(`Joint mismatch rows: ${payload.sourceSections.joint.mismatches.length}`);
  console.log(`Wrote ${outFile}`);
}

main();
