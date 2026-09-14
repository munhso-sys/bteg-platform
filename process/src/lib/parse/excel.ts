/**
 * Parse process matrices from xlsx/csv (IPO / ГХЗМ / HMMZA step sheets).
 */
import * as XLSX from "xlsx";
import type { MatrixKind, ProcessMatrixRow } from "@/lib/types";
import { newId } from "@/lib/cn";

export type ParsedMatrixBundle = {
  kind: MatrixKind;
  title: string;
  sheet_names: string[];
  rows: Omit<
    ProcessMatrixRow,
    "id" | "process_id" | "file_id" | "sort_order"
  >[];
};

function cellStr(v: unknown): string {
  if (v == null) return "";
  return String(v).replace(/\s+/g, " ").trim();
}

function detectKind(headers: string[]): MatrixKind {
  const h = headers.map((x) => x.toLowerCase());
  const joined = h.join("|");
  if (
    joined.includes("оролт") &&
    (joined.includes("гаралт") || joined.includes("үйл явц"))
  ) {
    if (joined.includes("оролцоо") || joined.includes("гхзм")) return "GHZM";
    return "IPO";
  }
  if (joined.includes("sipoc")) return "SIPOC";
  if (joined.includes("raci") || joined.includes("responsible")) return "RACI";
  if (
    joined.includes("ажлын даалгавар") ||
    joined.includes("албан тушаал") ||
    joined.includes("үйл явц")
  ) {
    return "STEPS";
  }
  return "GENERIC";
}

function mapGhzmToRaci(
  roleMatrix: Record<string, string>,
): Pick<
  ProcessMatrixRow,
  | "responsible_role"
  | "accountable_role"
  | "consulted_role"
  | "informed_role"
> {
  let responsible_role: string | null = null;
  let accountable_role: string | null = null;
  let consulted_role: string | null = null;
  let informed_role: string | null = null;
  for (const [role, letter] of Object.entries(roleMatrix)) {
    const L = letter.toUpperCase();
    // Г=Гүйцэтгэх≈R, Х=Хянах≈A/C, З=Зөвшөөрөх≈A, М=Мэдээлэх≈I
    if (L === "Г" || L === "G" || L === "R") {
      responsible_role = responsible_role ? `${responsible_role}, ${role}` : role;
    } else if (L === "З" || L === "Z" || L === "A") {
      accountable_role = accountable_role ? `${accountable_role}, ${role}` : role;
    } else if (L === "Х" || L === "H" || L === "C") {
      consulted_role = consulted_role ? `${consulted_role}, ${role}` : role;
    } else if (L === "М" || L === "M" || L === "I") {
      informed_role = informed_role ? `${informed_role}, ${role}` : role;
    }
  }
  return {
    responsible_role,
    accountable_role,
    consulted_role,
    informed_role,
  };
}

function findHeaderRow(aoa: unknown[][], maxScan = 12): number {
  for (let i = 0; i < Math.min(maxScan, aoa.length); i++) {
    const row = (aoa[i] ?? []).map(cellStr);
    const joined = row.join("|").toLowerCase();
    if (
      joined.includes("оролт") ||
      joined.includes("ажлын даалгавар") ||
      joined.includes("үйл явц") ||
      joined.includes("sipoc") ||
      (joined.includes("№") && joined.includes("гаралт"))
    ) {
      return i;
    }
  }
  return 0;
}

function parseSheet(
  sheetName: string,
  sheet: XLSX.WorkSheet,
): ParsedMatrixBundle["rows"] {
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  }) as unknown[][];
  if (!aoa.length) return [];

  const headerIdx = findHeaderRow(aoa);
  const headerRow = (aoa[headerIdx] ?? []).map(cellStr);
  // Sometimes roles are on the next row
  const roleRow = (aoa[headerIdx + 1] ?? []).map(cellStr);
  const kind = detectKind(headerRow);

  const col = {
    step: headerRow.findIndex((h) => /^№|^no\.?$|^#/i.test(h)),
    task: headerRow.findIndex((h) =>
      /ажлын даалгавар|task|үйл явц|process/i.test(h),
    ),
    input: headerRow.findIndex((h) => /оролт|input|supplier/i.test(h)),
    output: headerRow.findIndex((h) => /гаралт|output|customer|үр дүн/i.test(h)),
    process: headerRow.findIndex((h) => /үйл явц|process/i.test(h)),
    sysIn: headerRow.findIndex((h) => /систем.*оролт|system.*in/i.test(h)),
    sysOut: headerRow.findIndex((h) => /систем.*үр|system.*out|бичиг баримт.*гаралт/i.test(h)),
    position: headerRow.findIndex((h) => /албан тушаал|position|role/i.test(h)),
  };

  // Role columns: after "Оролцоо" or any short role codes
  const roleStart = headerRow.findIndex((h) => /оролцоо|гхзм|raci/i.test(h));
  const roleCols: { idx: number; name: string }[] = [];
  for (let i = 0; i < headerRow.length; i++) {
    if (roleStart >= 0 && i <= roleStart) continue;
    const name = headerRow[i] || roleRow[i];
    if (!name) continue;
    if (
      /оролт|гаралт|үйл явц|№|ажлын|систем|албан|бичиг|process|input|output/i.test(
        name,
      )
    ) {
      continue;
    }
    if (name.length <= 24) roleCols.push({ idx: i, name });
  }

  const dataStart =
    roleStart >= 0 && roleRow.some((c) => c.length > 0 && c.length <= 8)
      ? headerIdx + 2
      : headerIdx + 1;

  const rows: ParsedMatrixBundle["rows"] = [];
  for (let r = dataStart; r < aoa.length; r++) {
    const line = (aoa[r] ?? []).map(cellStr);
    if (line.every((c) => !c)) continue;
    const task_name =
      (col.task >= 0 ? line[col.task] : "") ||
      (col.process >= 0 ? line[col.process] : "") ||
      "";
    const input_data = col.input >= 0 ? line[col.input] || null : null;
    const output_data = col.output >= 0 ? line[col.output] || null : null;
    if (!task_name && !input_data && !output_data) continue;
    // Skip padded empty excel rows
    if (!task_name && !(input_data || output_data)) continue;

    const role_matrix: Record<string, string> = {};
    for (const rc of roleCols) {
      const v = line[rc.idx];
      if (v) role_matrix[rc.name] = v;
    }
    const raci = mapGhzmToRaci(role_matrix);
    const stepRaw = col.step >= 0 ? line[col.step] : "";
    const step_number = stepRaw ? Number(String(stepRaw).replace(/\D/g, "")) || null : null;

    rows.push({
      matrix_kind: kind,
      sheet_name: sheetName,
      step_number,
      task_name: task_name || `Мөр ${r + 1}`,
      input_data,
      process_text: col.process >= 0 ? line[col.process] || null : null,
      output_data,
      system_input: col.sysIn >= 0 ? line[col.sysIn] || null : null,
      system_output: col.sysOut >= 0 ? line[col.sysOut] || null : null,
      role_matrix,
      ...raci,
      position_title: col.position >= 0 ? line[col.position] || null : null,
      notes: null,
      diagram_node_id: null,
    });
  }
  return rows;
}

export function parseExcelBuffer(
  buf: Buffer,
  fileName: string,
): ParsedMatrixBundle {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const sheet_names = wb.SheetNames;
  const allRows: ParsedMatrixBundle["rows"] = [];
  let kind: MatrixKind = "GENERIC";

  for (const name of sheet_names) {
    const sheet = wb.Sheets[name];
    if (!sheet) continue;
    const rows = parseSheet(name, sheet);
    if (!rows.length) continue;
    kind = rows[0]?.matrix_kind ?? kind;
    // Cap per sheet to avoid Excel padding explosion
    allRows.push(...rows.slice(0, 200));
  }

  return {
    kind,
    title: fileName.replace(/\.(xlsx|xls|csv)$/i, ""),
    sheet_names,
    rows: allRows,
  };
}

export function parseCsvBuffer(
  buf: Buffer,
  fileName: string,
): ParsedMatrixBundle {
  const wb = XLSX.read(buf.toString("utf8"), { type: "string" });
  return parseExcelBuffer(
    Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" })),
    fileName,
  );
}

/** Assign ids when persisting. */
export function materializeMatrixRows(
  processId: string,
  fileId: string,
  parsed: ParsedMatrixBundle,
): ProcessMatrixRow[] {
  return parsed.rows.map((row, i) => ({
    ...row,
    id: newId("mtx"),
    process_id: processId,
    file_id: fileId,
    sort_order: i + 1,
  }));
}
