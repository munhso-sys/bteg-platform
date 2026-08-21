"use client";

import Link from "next/link";
import { ReportsFrame } from "@/components/reports/ReportsFrame";
import { ReportKpiCard } from "@/components/reports/ReportKpiCard";
import { FolderTree } from "@/components/reports/FolderTree";
import { ReportRowsTable } from "@/components/reports/ReportRowsTable";
import { ExportBar } from "@/components/reports/ExportBar";
import { ReportMatrix } from "@/components/reports/ReportMatrix";
import { LEVEL_LABELS } from "@/lib/reports/types";
import { formatGeneratedAt, signalExportRows } from "@/components/reports/reportLabels";

const TOOLS = [
  { href: "/report-analysis/kpis", title: "KPI сан", text: "Удирдлага, ДХШХ, нэгж, модулийн үзүүлэлт" },
  { href: "/report-analysis/analysis", title: "Шинжилгээ", text: "Эх систем, матриц, нэгж, хоцролт, дуу хоолой" },
  { href: "/report-analysis/tree", title: "Хавтас", text: "Дэлгэх / хураах мод, дэд хуудас" },
  { href: "/report-analysis/operations", title: "Түвшин", text: "Дөрвөн түвшний үйл ажиллагааны самбар" },
  { href: "/report-analysis/exports", title: "Экспорт", text: "Excel болон PDF тайлан" },
  { href: "/risk-management", title: "Эрсдэл", text: "Бүртгэл, матриц, засвар, хавтас" },
];

export default function ReportAnalysisPage() {
  return (
    <ReportsFrame
      title="ДХШХ-ийн үйл ажиллагааны нэгдсэн удирдлага"
      description="Хяналт шалгалт, журмын биелэлт, судалгаа хөгжүүлэлт, ажилтны дуу хоолой, эрсдэл, хандалтыг нэг платформ дээр KPI, шинжилгээ, хавтас, экспортоор удирдана."
    >
      {({ data, loading }) => {
        const lead = (data?.kpis ?? []).filter((k) => k.level === "leadership" || k.level === "dxshh").slice(0, 8);
        return (
          <>
            <p className="mb-3 text-xs text-[var(--muted)] print:hidden">
              {loading && !data
                ? "Ачааллаж байна…"
                : `Сүүлд шинэчилсэн: ${formatGeneratedAt(data?.generatedAt)}`}
            </p>

            <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {lead.map((k) => (
                <ReportKpiCard
                  key={k.id}
                  label={k.label}
                  value={k.value}
                  hint={k.hint}
                  tone={k.tone}
                />
              ))}
            </section>

            <section className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3 print:hidden">
              {TOOLS.map((t) => (
                <Link
                  key={t.href}
                  href={t.href}
                  className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-sm hover:border-[var(--brand)]"
                >
                  <div className="font-semibold">{t.title}</div>
                  <div className="mt-1 text-[var(--muted)]">{t.text}</div>
                </Link>
              ))}
            </section>

            <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)]">
              <section className="rounded-md border border-[var(--border)] bg-[var(--card)]">
                <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold">
                  Эх системээр
                </div>
                <div className="grid gap-2 p-3 sm:grid-cols-2">
                  {(data?.bySystem ?? []).map((row) => (
                    <div
                      key={row.system}
                      className="rounded border border-[var(--border)] px-3 py-2"
                    >
                      <div className="text-[11px] uppercase tracking-wide text-[var(--muted)]">
                        {row.system}
                      </div>
                      <div className="text-xl font-semibold tabular-nums">{row.count}</div>
                      <div className="text-xs text-[var(--muted)]">Өндөр {row.high}</div>
                    </div>
                  ))}
                </div>
              </section>
              <section className="rounded-md border border-[var(--border)] bg-[var(--card)]">
                <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold">
                  Магадлал × нөлөө
                </div>
                <div className="p-3">
                  <ReportMatrix cells={data?.matrix ?? []} />
                </div>
              </section>
            </div>

            <div className="mb-4 grid gap-3 lg:grid-cols-2">
              <section className="rounded-md border border-[var(--border)] bg-[var(--card)]">
                <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold">
                  Дүгнэлт
                </div>
                <ul className="space-y-1 p-3 text-sm">
                  {(data?.conclusions ?? (loading ? ["Тооцоолж байна…"] : [])).map((line) => (
                    <li
                      key={line}
                      className="rounded border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              </section>
              <section className="rounded-md border border-[var(--border)] bg-[var(--card)]">
                <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
                  <h2 className="text-sm font-semibold">Хавтас</h2>
                  <Link
                    href="/report-analysis/tree"
                    className="text-xs text-[var(--brand)] print:hidden"
                  >
                    Бүгдийг харах
                  </Link>
                </div>
                <div className="soft-scroll max-h-72 p-2">
                  <FolderTree nodes={data?.tree ?? []} openMode="smart" />
                </div>
              </section>
            </div>

            <section className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Сүүлийн дохио</h2>
              <ExportBar
                tableId="report-home-rows"
                filename="dxshh-nedsen-dohio"
                extraRows={signalExportRows(data?.rows ?? [])}
              />
            </section>
            <ReportRowsTable
              id="report-home-rows"
              rows={(data?.rows ?? []).slice(0, 20)}
              empty={loading ? "Ачааллаж байна…" : "Дохио алга."}
            />

            <p className="mt-3 text-xs text-[var(--muted)]">
              Түвшин: {Object.values(LEVEL_LABELS).join(" · ")}
            </p>
          </>
        );
      }}
    </ReportsFrame>
  );
}
