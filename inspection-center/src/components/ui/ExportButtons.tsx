"use client";

import { Download, FileText, FileType2, Layers } from "lucide-react";
import type { ConsolidatedReport } from "@/lib/runs/consolidated-report";
import {
  downloadConsolidatedReportWord,
  printConsolidatedReportPdf,
  type ConsolidatedReportExportInput,
} from "@/lib/runs/export-consolidated-word";

function cleanCell(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function csvEscape(value: string) {
  const normalized = cleanCell(value);
  return /[",\n]/.test(normalized)
    ? `"${normalized.replace(/"/g, '""')}"`
    : normalized;
}

function cellExportText(cell: Element) {
  const fields = Array.from(
    cell.querySelectorAll("input, textarea, select"),
  ) as Array<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>;
  if (fields.length > 0) {
    return fields
      .map((field) => {
        if (field instanceof HTMLInputElement) {
          if (field.type === "checkbox" || field.type === "radio") {
            return field.checked ? "Тийм" : "Үгүй";
          }
          return field.value;
        }
        return field.value;
      })
      .filter(Boolean)
      .join(" ");
  }
  return cell.textContent ?? "";
}

export function printWithMode(mode: string) {
  const previous = document.body.dataset.printMode;
  document.body.dataset.printMode = mode;

  let pageStyle: HTMLStyleElement | null = null;
  if (mode === "consolidated-report") {
    pageStyle = document.createElement("style");
    pageStyle.setAttribute("data-print-page", "consolidated-report");
    pageStyle.textContent = `
      @page {
        size: A4 landscape;
        margin: 0.5in;
      }
    `;
    document.head.appendChild(pageStyle);
  }

  const cleanup = () => {
    if (previous) document.body.dataset.printMode = previous;
    else delete document.body.dataset.printMode;
    pageStyle?.remove();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

export function ExportButtons({
  tableId,
  filename,
  excelLabel = "Excel",
  pdfLabel = "PDF",
  pdfPrintMode,
  pdfTitle,
  metaRows,
}: {
  tableId: string;
  filename: string;
  excelLabel?: string;
  pdfLabel?: string;
  /** When set, PDF prints only the matching print-mode section */
  pdfPrintMode?: string;
  pdfTitle?: string;
  /** Optional header/meta rows prepended to Excel (CSV) export */
  metaRows?: string[][];
}) {
  function downloadCsv() {
    const table = document.getElementById(tableId);
    if (!table) return;
    const tableRows = Array.from(table.querySelectorAll("tr")).map((row) =>
      Array.from(row.querySelectorAll("th,td"))
        .map((cell) => csvEscape(cellExportText(cell)))
        .join(","),
    );
    const prefix = (metaRows ?? []).map((row) =>
      row.map((cell) => csvEscape(cell)).join(","),
    );
    const rows = prefix.length > 0 ? [...prefix, "", ...tableRows] : tableRows;
    const blob = new Blob([`\ufeff${rows.join("\n")}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <button
        type="button"
        className="btn"
        onClick={downloadCsv}
        title="Excel (CSV) татах"
      >
        <Download size={16} />
        {excelLabel}
      </button>
      <button
        type="button"
        className="btn"
        onClick={() =>
          pdfPrintMode ? printWithMode(pdfPrintMode) : window.print()
        }
        title={pdfTitle ?? "PDF болгон хадгалах / хэвлэх"}
      >
        <FileText size={16} />
        {pdfLabel}
      </button>
    </>
  );
}

export function ConsolidatedReportPdfButton({
  disabled,
  label = "Үл тохирлын тайлан PDF",
  report,
  runTitle,
  inspectionDate,
  inspectedByOrg,
  performers,
  inspectionType,
}: {
  disabled?: boolean;
  label?: string;
  report: ConsolidatedReport;
  runTitle: string;
  inspectionDate: string;
  inspectedByOrg?: string;
  performers?: Array<{ name: string; position: string }>;
  inspectionType?: "JOINT_INSPECTION" | "NIGHT_INSPECTION";
}) {
  const isNight = inspectionType === "NIGHT_INSPECTION";
  const payload: ConsolidatedReportExportInput = {
    report,
    runTitle,
    inspectionDate,
    inspectedByOrg,
    performers,
    inspectionType,
  };
  return (
    <button
      type="button"
      className="btn btn-primary"
      disabled={disabled}
      onClick={() => printConsolidatedReportPdf(payload)}
      title={`${isNight ? "Шөнийн" : "Хамтарсан"} ХШ-ын үл тохирлын тайланг PDF болгон хадгалах (Word-той ижил)`}
    >
      <Layers size={16} />
      {label}
    </button>
  );
}

export function ConsolidatedReportWordButton({
  disabled,
  report,
  runTitle,
  inspectionDate,
  inspectedByOrg,
  performers,
  filename,
  label = "Үл тохирлын тайлан Word",
  inspectionType,
}: {
  disabled?: boolean;
  report: ConsolidatedReport;
  runTitle: string;
  inspectionDate: string;
  inspectedByOrg?: string;
  performers?: Array<{ name: string; position: string }>;
  filename?: string;
  label?: string;
  inspectionType?: "JOINT_INSPECTION" | "NIGHT_INSPECTION";
}) {
  const isNight = inspectionType === "NIGHT_INSPECTION";
  return (
    <button
      type="button"
      className="btn"
      disabled={disabled}
      onClick={() =>
        downloadConsolidatedReportWord({
          report,
          runTitle,
          inspectionDate,
          inspectedByOrg,
          performers,
          filename,
          inspectionType,
        })
      }
      title={`${isNight ? "Шөнийн" : "Хамтарсан"} ХШ-ын үл тохирлын тайланг MS Word (.doc) болгон татах`}
    >
      <FileType2 size={16} />
      {label}
    </button>
  );
}
