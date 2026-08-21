#!/usr/bin/env npx tsx
/**
 * Excel importer for Inspection Center checklist templates.
 *
 * Usage:
 *   npx tsx scripts/import-excel.ts [path-to.xlsm] [--include-hidden] [--list-only]
 */
import * as fs from "fs";
import * as path from "path";
import {
  importVisibleChecklists,
  listWorkbookSheets,
  isChecklistSheetName,
} from "./excel-import-lib";

const DEFAULT_WORKBOOK =
  "C:/Users/Owner/.openclaw/media/inbound/TEST_2026-04-23---c681df84-7f14-477b-b352-a5b94766a6b7.xlsm";

function main() {
  const args = process.argv.slice(2);
  const listOnly = args.includes("--list-only");
  const includeHidden = args.includes("--include-hidden");
  const workbookPath =
    args.find((a) => !a.startsWith("--")) || DEFAULT_WORKBOOK;

  if (!fs.existsSync(workbookPath)) {
    console.error(`Workbook not found: ${workbookPath}`);
    process.exit(1);
  }

  console.log(`Workbook: ${workbookPath}`);

  if (listOnly) {
    const sheets = listWorkbookSheets(workbookPath);
    const visible = sheets.filter((s) => !s.hidden);
    const hidden = sheets.filter((s) => s.hidden);
    const checklists = visible.filter((s) => isChecklistSheetName(s.name));

    console.log(`Total sheets: ${sheets.length}`);
    console.log(`Visible: ${visible.length}`);
    console.log(`Hidden: ${hidden.length}`);
    console.log(`Visible checklist candidates: ${checklists.length}`);
    console.log("\nVisible sheets:");
    for (const s of visible) {
      const tag = isChecklistSheetName(s.name) ? " [checklist]" : "";
      console.log(`  - ${s.name}${tag}`);
    }
    return;
  }

  const { sheets, bundles } = importVisibleChecklists(workbookPath, {
    includeHidden,
  });

  const visible = sheets.filter((s) => !s.hidden);
  const outDir = path.join(process.cwd(), "data");
  fs.mkdirSync(outDir, { recursive: true });

  const payload = {
    importedAt: new Date().toISOString(),
    workbookPath,
    sheetSummary: {
      total: sheets.length,
      visible: visible.length,
      hidden: sheets.length - visible.length,
      checklistTemplates: bundles.length,
    },
    templates: bundles.map((b) => b.template),
    sections: bundles.flatMap((b) => b.sections),
    questions: bundles.flatMap((b) => b.questions),
  };

  const outFile = path.join(outDir, "imported-templates.json");
  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), "utf8");

  console.log(`Visible sheets: ${visible.length}`);
  console.log(`Imported checklist templates: ${bundles.length}`);
  for (const b of bundles) {
    console.log(
      `  ${b.template.code} — ${b.template.title} (${b.questions.length} questions, ${b.sections.length} sections)`,
    );
  }
  console.log(`Wrote ${outFile}`);
}

main();
