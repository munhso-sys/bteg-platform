"use client";

import { ReportsFrame } from "@/components/reports/ReportsFrame";
import { ExportBar, downloadExcel, printReportPdf } from "@/components/reports/ExportBar";
import { ReportRowsTable } from "@/components/reports/ReportRowsTable";
import { ReportKpiCard } from "@/components/reports/ReportKpiCard";
import { kpiExportRows, signalExportRows } from "@/components/reports/reportLabels";
import { LEVEL_LABELS } from "@/lib/reports/types";
import type { PlatformReport } from "@/lib/reports/types";
import { Download, FileText } from "lucide-react";

function sheetsFrom(data: PlatformReport) {
  return [
    { name: "KPI", rows: kpiExportRows(data.kpis) },
    {
      name: "Нэгж",
      rows: [
        ["Нэгж", "Дохио", "Өндөр", "Хэтэрсэн", "Дуу хоолой", "Үлдэгдэл"],
        ...data.units.map((u) => [
          u.unit,
          String(u.signals),
          String(u.high),
          String(u.overdue),
          String(u.voice),
          `${u.residual}%`,
        ]),
      ],
    },
    { name: "Дохио", rows: signalExportRows(data.rows) },
    {
      name: "Систем",
      rows: [
        ["Систем", "Тоо", "Өндөр"],
        ...data.bySystem.map((s) => [s.system, String(s.count), String(s.high)]),
      ],
    },
    {
      name: "Дүгнэлт",
      rows: [["Дүгнэлт"], ...data.conclusions.map((c) => [c])],
    },
  ];
}

export default function ReportExportsPage() {
  return (
    <ReportsFrame
      title="Экспорт"
      description="Нэгдсэн өгөгдлийг Excel-ээр, албан тайланг server-side PDF болон MS Word DOCX хэлбэрээр татна."
    >
      {({ data }) => {
        const sheets = data ? sheetsFrom(data) : [];
        return (
          <>
            <div className="mb-4 flex flex-wrap gap-2 print:hidden">
              <a className="btn btn-primary" href="/api/reports/export?format=pdf">
                <FileText size={14} /> Албан PDF
              </a>
              <a className="btn" href="/api/reports/export?format=docx">
                <Download size={14} /> MS Word
              </a>
              <button
                type="button"
                className="btn"
                disabled={!data}
                onClick={() => data && downloadExcel("dxshh-nedsen-tailan", sheets)}
              >
                <Download size={14} /> Бүх хуудас Excel
              </button>
              <button type="button" className="btn" onClick={() => printReportPdf()}>
                <FileText size={14} /> Нэгдсэн PDF
              </button>
            </div>

            <section className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4 print:hidden">
              {sheets.map((sheet) => (
                <div
                  key={sheet.name}
                  className="rounded-md border border-[var(--border)] bg-[var(--card)] p-3"
                >
                  <div className="text-sm font-semibold">{sheet.name}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">
                    {Math.max(0, sheet.rows.length - 1)} мөр
                  </div>
                  <div className="mt-2">
                    <ExportBar
                      filename={`dxshh-${sheet.name}`}
                      extraRows={sheet.rows}
                    />
                  </div>
                </div>
              ))}
            </section>

            <section className="mb-4">
              <h2 className="mb-2 text-sm font-semibold">KPI тойм</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {(data?.kpis ?? []).slice(0, 12).map((k) => (
                  <ReportKpiCard
                    key={k.id}
                    label={`${LEVEL_LABELS[k.level]} · ${k.label}`}
                    value={k.value}
                    hint={k.hint}
                    tone={k.tone}
                  />
                ))}
              </div>
            </section>

            <section className="mb-4">
              <h2 className="mb-2 text-sm font-semibold">Дүгнэлт</h2>
              <ul className="space-y-1 text-sm">
                {(data?.conclusions ?? []).map((line) => (
                  <li
                    key={line}
                    className="rounded border border-[var(--border)] bg-[var(--card)] px-3 py-2"
                  >
                    {line}
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h2 className="mb-2 text-sm font-semibold">Дохионы бүртгэл</h2>
              <ReportRowsTable
                id="export-rows"
                rows={data?.rows ?? []}
                empty="Мөр алга."
              />
            </section>
          </>
        );
      }}
    </ReportsFrame>
  );
}
