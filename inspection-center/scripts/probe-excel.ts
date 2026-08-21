import * as XLSX from "xlsx";
import * as fs from "fs";

const path =
  process.argv[2] ||
  "C:/Users/Owner/.openclaw/media/inbound/TEST_2026-04-23---c681df84-7f14-477b-b352-a5b94766a6b7.xlsm";

console.log("Reading", path);
console.log("exists", fs.existsSync(path));

const wb = XLSX.readFile(path, { cellDates: true });
const sheetMeta = wb.Workbook?.Sheets ?? [];

const visible: string[] = [];
const hidden: string[] = [];

for (const name of wb.SheetNames) {
  const meta = sheetMeta.find((s) => s.name === name);
  const isHidden = meta?.Hidden === 1 || meta?.Hidden === 2;
  (isHidden ? hidden : visible).push(name);
}

console.log("total", wb.SheetNames.length);
console.log("visible", visible.length);
console.log("hidden", hidden.length);
console.log("--- VISIBLE ---");
for (const n of visible) console.log(n);

const sample = ["6.1", "5.13", "7.1.1", "HOME", "ХШХ"];
for (const name of sample) {
  if (!wb.Sheets[name]) {
    console.log("MISSING", name);
    continue;
  }
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(
    wb.Sheets[name],
    { header: 1, defval: null, raw: false },
  );
  console.log(`\n==== ${name} rows=${rows.length} ====`);
  for (let i = 0; i < Math.min(16, rows.length); i++) {
    const r = rows[i] || [];
    const preview = r
      .slice(0, 12)
      .map((c) =>
        c == null ? "" : String(c).slice(0, 70).replace(/\n/g, " "),
      );
    console.log(`${i + 1}: ${JSON.stringify(preview)}`);
  }
}
