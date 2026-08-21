"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ReportsFrame } from "@/components/reports/ReportsFrame";
import { ExportBar } from "@/components/reports/ExportBar";
import { ReportMatrix } from "@/components/reports/ReportMatrix";
import { ReportRowsTable } from "@/components/reports/ReportRowsTable";
import { ReportKpiCard } from "@/components/reports/ReportKpiCard";
import { ANALYSIS_TOOLS } from "@/lib/reports/types";
import { cn } from "@/lib/cn";
import { signalExportRows } from "@/components/reports/reportLabels";
import type { PlatformReport } from "@/lib/reports/types";

function AnalysisInner() {
  const params = useSearchParams();
  const tool = params.get("tool") || ANALYSIS_TOOLS[0].id;

  return (
    <ReportsFrame
      title="Шинжилгээ"
      description="Багаж, хэрэгсэл сонгож эх систем, эрсдэлийн матриц, нэгж, хоцролт, дуу хоолой, хамрагдалтыг шинжилнэ."
    >
      {({ data }) => (
        <div className="grid gap-4 lg:grid-cols-[minmax(13rem,16rem)_minmax(0,1fr)]">
          <aside className="rounded-md border border-[var(--border)] bg-[var(--card)] print:hidden">
            <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold">
              Багаж
            </div>
            <ul className="p-2">
              {ANALYSIS_TOOLS.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/report-analysis/analysis?tool=${t.id}`}
                    className={cn(
                      "block rounded px-3 py-2 text-sm",
                      tool === t.id
                        ? "bg-[var(--surface-muted)] font-semibold"
                        : "hover:bg-[var(--surface-muted)]",
                    )}
                  >
                    {t.label}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
          <div>
            <ToolView tool={tool} data={data} />
          </div>
        </div>
      )}
    </ReportsFrame>
  );
}

function ToolView({
  tool,
  data,
}: {
  tool: string;
  data: PlatformReport | null;
}) {
  const meta = ANALYSIS_TOOLS.find((t) => t.id === tool) ?? ANALYSIS_TOOLS[0];
  const overdue = useMemo(
    () => (data?.rows ?? []).filter((r) => r.status === "overdue"),
    [data],
  );
  const maxSys = Math.max(1, ...(data?.bySystem ?? []).map((s) => s.count));
  const maxUnit = Math.max(
    1,
    ...(data?.units ?? []).map((u) => u.signals + u.voice),
  );

  return (
    <section className="rounded-md border border-[var(--border)] bg-[var(--card)]">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
        <div>
          <h2 className="text-sm font-semibold">{meta.label}</h2>
          <p className="mt-0.5 text-xs text-[var(--muted)]">{meta.description}</p>
        </div>
        <ExportBar
          filename={`shinilgee-${tool}`}
          extraRows={
            tool === "units"
              ? [
                  ["Нэгж", "Дохио", "Өндөр", "Хэтэрсэн", "Дуу хоолой", "Үлдэгдэл"],
                  ...(data?.units ?? []).map((u) => [
                    u.unit,
                    String(u.signals),
                    String(u.high),
                    String(u.overdue),
                    String(u.voice),
                    `${u.residual}%`,
                  ]),
                ]
              : tool === "voice"
                ? [
                    ["Сэдэв", "Тоо"],
                    ...(data?.voiceThemes ?? []).map((t) => [t.label, String(t.count)]),
                  ]
                : signalExportRows(
                    tool === "overdue" ? overdue : (data?.rows ?? []),
                  )
          }
        />
      </div>
      <div className="p-3">
        {tool === "source-mix" ? (
          <div className="space-y-3">
            {(data?.bySystem ?? []).map((row) => (
              <div key={row.system}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{row.system}</span>
                  <span className="tabular-nums text-[var(--muted)]">
                    {row.count} · өндөр {row.high}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded bg-[var(--surface-muted)]">
                  <div
                    className="h-full bg-[var(--brand)]"
                    style={{ width: `${Math.round((row.count / maxSys) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {tool === "matrix" ? <ReportMatrix cells={data?.matrix ?? []} /> : null}

        {tool === "units" ? (
          <div className="overflow-x-auto">
            <table id="analysis-units">
              <thead>
                <tr>
                  <th>Нэгж</th>
                  <th>Дохио</th>
                  <th>Өндөр</th>
                  <th>Хэтэрсэн</th>
                  <th>Дуу хоолой</th>
                  <th>Үлдэгдэл</th>
                </tr>
              </thead>
              <tbody>
                {(data?.units ?? []).map((u) => (
                  <tr key={u.unit}>
                    <td className="font-medium">{u.unit}</td>
                    <td className="tabular-nums">{u.signals}</td>
                    <td className="tabular-nums">{u.high}</td>
                    <td className="tabular-nums">{u.overdue}</td>
                    <td className="tabular-nums">{u.voice}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded bg-[var(--surface-muted)]">
                          <div
                            className="h-full bg-[var(--brand)]"
                            style={{
                              width: `${Math.round(((u.signals + u.voice) / maxUnit) * 100)}%`,
                            }}
                          />
                        </div>
                        <span className="tabular-nums text-xs">{u.residual}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {tool === "overdue" ? (
          <ReportRowsTable
            id="analysis-overdue"
            rows={overdue}
            empty="Хугацаа хэтэрсэн дохио алга."
          />
        ) : null}

        {tool === "voice" ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {(data?.voiceThemes ?? []).map((t) => (
              <div
                key={t.label}
                className="rounded border border-[var(--border)] px-3 py-2"
              >
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-xl font-semibold tabular-nums">{t.count}</div>
              </div>
            ))}
            {(data?.voiceThemes ?? []).length === 0 ? (
              <p className="text-sm text-[var(--muted)]">Сэдэв алга.</p>
            ) : null}
          </div>
        ) : null}

        {tool === "coverage" ? (
          <div>
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(data?.kpis ?? [])
                .filter((k) => k.id === "dx-coverage" || k.id === "dx-inprogress" || k.id === "dx-overdue")
                .map((k) => (
                  <ReportKpiCard
                    key={k.id}
                    label={k.label}
                    value={k.value}
                    hint={k.hint}
                    tone={k.tone}
                  />
                ))}
            </div>
            <ReportRowsTable
              id="analysis-coverage"
              rows={data?.rows ?? []}
              empty="Мөр алга."
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function ReportAnalysisToolsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Ачааллаж байна…</p>}>
      <AnalysisInner />
    </Suspense>
  );
}
