import * as fs from "fs";
import * as path from "path";

const INDICATORS_FILE = path.join(
  process.cwd(),
  "data",
  "sidebar-findings-indicators.json",
);

export interface SidebarFindingIndicators {
  importedAt?: string;
  workbookPath?: string;
  sourceSheetName: string;
  sourceSections: {
    state: {
      windowNo: number;
      title: string;
      sourceSheetName: string;
      filterCell: string;
      formulas: Record<string, string | null>;
      totalChecklists: number | null;
      selectedOffset: number;
      rows: StateIndicatorRow[];
    };
    night: {
      windowNo: number;
      title: string;
      sourceSheetName: string;
      filterCell: string;
      formulas: Record<string, string | null>;
      selectedOffset: number;
      monthly: NightMonthlyRow[];
      categories: NightCategoryRow[];
      mismatches: CountedItemRow[];
      mismatchTotal: number | null;
    };
    joint: {
      windowNo: number;
      title: string;
      sourceSheetName: string;
      filterCells: string[];
      formulas: Record<string, string | null>;
      selectedYear: string;
      selectedCategoryCode: string;
      unitOffset: number;
      mismatchOffset: number;
      categories: JointCategoryRow[];
      units: JointUnitRow[];
      mismatches: CountedItemRow[];
      totalCount: number | null;
      resolvedTotal: number | null;
      resolvedPercent: number | null;
    };
  };
}

export interface StateIndicatorRow {
  sourceRow: number;
  sequence: number | null;
  authority: string;
  inspectionCount: number | null;
  displayNo: number;
  implementationPercent: number | null;
  checklistName: string;
  inspectionDate: string;
  responsibleEmployee: string;
  progressPercent: number | null;
  riskPercent: number | null;
  violationCount: number | null;
}

export interface NightMonthlyRow {
  sourceRow: number;
  monthRange: string;
  inspectionCount: number | null;
  violationCount: number | null;
  resolvedCount: number | null;
  resolvedPercent: number | null;
}

export interface NightCategoryRow {
  sourceRow: number;
  category: string;
  violationCount: number | null;
  sharePercent: number | null;
}

export interface JointCategoryRow {
  sourceRow: number;
  code: string;
  name: string;
  violationCount: number | null;
  sharePercent: number | null;
  resolvedCount: number | null;
  resolvedPercent: number | null;
}

export interface JointUnitRow {
  sourceRow: number;
  unit: string;
  environmentCount: number | null;
  internalCount: number | null;
  safetyCount: number | null;
  hygieneCount: number | null;
  totalCount: number | null;
}

export interface CountedItemRow {
  sourceRow: number;
  item: string;
  count: number | null;
}

export function readSidebarFindingIndicators(): SidebarFindingIndicators | null {
  if (!fs.existsSync(INDICATORS_FILE)) return null;
  return JSON.parse(fs.readFileSync(INDICATORS_FILE, "utf8")) as SidebarFindingIndicators;
}
