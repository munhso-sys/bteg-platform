"use client";

import { Download, FileText, FileType2, ShieldAlert } from "lucide-react";
import { ReportsFrame } from "@/components/reports/ReportsFrame";
import { buildFormalReport } from "@/lib/reports/formal-report";

export default function FormalReportPage() {
  return (
    <ReportsFrame
      title="Албан тайлан"
      description="Удирдлагын хураангуй, KPI, арга зүй, суурь шалтгааны дохио, нэн тэргүүний олдвор болон арга хэмжээний нэгдсэн загвар."
    >
      {({ data, loading }) => {
        const report = data ? buildFormalReport(data) : null;
        return (
          <div className="space-y-4">
            <section className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--card)] p-3 print:hidden">
              <div>
                <div className="text-sm font-semibold">Албан баримтын экспорт</div>
                <div className="mt-0.5 text-xs text-[var(--muted)]">
                  Server-side үүсгэсэн A4 PDF болон засварлах боломжтой MS Word DOCX.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  className="btn btn-primary"
                  aria-disabled={!report}
                  href={report ? "/api/reports/export?format=pdf" : undefined}
                >
                  <FileText size={14} /> PDF татах
                </a>
                <a
                  className="btn"
                  aria-disabled={!report}
                  href={report ? "/api/reports/export?format=docx" : undefined}
                >
                  <FileType2 size={14} /> Word татах
                </a>
              </div>
            </section>

            {!report ? (
              <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-6 text-center text-sm text-[var(--muted)]">
                {loading ? "Тайлан боловсруулж байна…" : "Тайлангийн өгөгдөл алга."}
              </div>
            ) : (
              <article className="rounded-md border border-[var(--border)] bg-[var(--card)] p-4 sm:p-6">
                <header className="border-b border-[var(--border)] pb-4 text-center">
                  <div className="text-xs font-bold tracking-[0.16em] text-[var(--brand)]">
                    INSPECT-MN · BTEG
                  </div>
                  <h1 className="mt-2 text-xl font-bold sm:text-2xl">{report.title}</h1>
                  <p className="mx-auto mt-1 max-w-3xl text-sm text-[var(--muted)]">
                    {report.subtitle}
                  </p>
                  <div className="mt-3 flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-[var(--muted)]">
                    <span>{report.documentId}</span>
                    <span>{report.periodLabel}</span>
                  </div>
                </header>

                <ReportSection title="1. Удирдлагын хураангуй">
                  <BulletList items={report.executiveSummary} />
                </ReportSection>

                <ReportSection title="2. Гол KPI">
                  <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {report.kpis.map((item) => (
                      <div key={item.label} className="rounded border border-[var(--border)] p-3">
                        <div className="text-[11px] uppercase tracking-wide text-[var(--muted)]">{item.label}</div>
                        <div className="mt-1 text-xl font-semibold tabular-nums">{item.value}</div>
                        <div className="mt-1 text-xs text-[var(--muted)]">{item.interpretation}</div>
                      </div>
                    ))}
                  </div>
                </ReportSection>

                <ReportSection title="3. Арга зүй ба хамрах хүрээ">
                  <BulletList items={report.methodology} />
                </ReportSection>

                <ReportSection title="4. Суурь шалтгааны дохио">
                  <div className="grid gap-2 lg:grid-cols-3">
                    {report.rootCauseSignals.length ? report.rootCauseSignals.map((item) => (
                      <div key={item.title} className="rounded border border-amber-200 bg-amber-50 p-3 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
                        <div className="flex items-start gap-2 font-semibold"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />{item.title}</div>
                        <p className="mt-2 text-sm">{item.evidence}</p>
                        <p className="mt-2 text-xs opacity-80">{item.method}</p>
                        <p className="mt-1 text-[11px] font-medium">Indicator · Баталгаажсан root cause биш</p>
                      </div>
                    )) : <p className="text-sm text-[var(--muted)]">Статистик дохио үүсээгүй.</p>}
                  </div>
                </ReportSection>

                <ReportSection title="5. Нэн тэргүүний олдвор">
                  <div className="overflow-x-auto">
                    <table>
                      <thead><tr><th>Огноо</th><th>Систем / нэгж</th><th>Олдвор</th><th>Эрсдэл</th><th>Төлөв / эзэн</th></tr></thead>
                      <tbody>
                        {report.priorityFindings.map((item) => (
                          <tr key={item.id}>
                            <td className="whitespace-nowrap text-xs">{item.date}</td>
                            <td className="text-xs">{item.system}<br /><span className="text-[var(--muted)]">{item.unit}</span></td>
                            <td className="min-w-[18rem] text-sm">{item.title}</td>
                            <td className="text-xs font-medium">{item.severity}</td>
                            <td className="text-xs">{item.status}<br /><span className="text-[var(--muted)]">{item.owner}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ReportSection>

                <ReportSection title="6. Зөвлөмж, арга хэмжээ">
                  <BulletList items={report.recommendations} />
                </ReportSection>

                <ReportSection title="7. Хязгаарлалт ба баталгаажуулалт">
                  <BulletList items={report.limitations} />
                </ReportSection>

                <footer className="mt-6 flex items-center justify-between border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
                  <span>INSPECT-MN · Албан хэрэглээнд</span>
                  <a className="inline-flex items-center gap-1 text-[var(--brand)] print:hidden" href="/api/reports/export?format=pdf"><Download size={12} /> Экспорт</a>
                </footer>
              </article>
            )}
          </div>
        );
      }}
    </ReportsFrame>
  );
}

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-5"><h2 className="mb-2 text-base font-semibold text-[var(--brand)]">{title}</h2>{children}</section>;
}

function BulletList({ items }: { items: string[] }) {
  return <ul className="space-y-1.5 text-sm">{items.map((item) => <li key={item} className="flex gap-2"><span className="text-[var(--brand)]">•</span><span>{item}</span></li>)}</ul>;
}

