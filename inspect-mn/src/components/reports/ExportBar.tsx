"use client";

import { Download, FileText } from "lucide-react";

function csvEscape(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return /[",\n]/.test(normalized)
    ? `"${normalized.replace(/"/g, '""')}"`
    : normalized;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(filename: string, rows: string[][]) {
  const body = rows.map((row) => row.map((c) => csvEscape(c)).join(",")).join("\n");
  const blob = new Blob([`\ufeff${body}`], { type: "text/csv;charset=utf-8" });
  triggerDownload(blob, `${filename}.csv`);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function downloadExcel(
  filename: string,
  sheets: { name: string; rows: string[][] }[],
) {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8" /></head><body>
${sheets
  .map(
    (sheet) =>
      `<h2>${escapeHtml(sheet.name)}</h2><table border="1">${sheet.rows
        .map(
          (row) =>
            `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`,
        )
        .join("")}</table>`,
  )
  .join("")}
</body></html>`;
  const blob = new Blob([html], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  triggerDownload(blob, `${filename}.xls`);
}

export function exportTableCsv(tableId: string, filename: string) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const rows = Array.from(table.querySelectorAll("tr")).map((row) =>
    Array.from(row.querySelectorAll("th,td")).map((cell) =>
      (cell.textContent ?? "").replace(/\s+/g, " ").trim(),
    ),
  );
  downloadCsv(filename, rows);
}

export function printReportPdf() {
  window.print();
}

export function ExportBar({
  tableId,
  filename,
  extraRows,
  sheets,
}: {
  tableId?: string;
  filename: string;
  extraRows?: string[][];
  sheets?: { name: string; rows: string[][] }[];
}) {
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <button
        type="button"
        className="btn"
        onClick={() => {
          if (sheets?.length) downloadExcel(filename, sheets);
          else if (extraRows?.length) downloadCsv(filename, extraRows);
          else if (tableId) exportTableCsv(tableId, filename);
        }}
      >
        <Download size={14} /> Excel
      </button>
      <button type="button" className="btn" onClick={() => printReportPdf()}>
        <FileText size={14} /> PDF
      </button>
    </div>
  );
}
