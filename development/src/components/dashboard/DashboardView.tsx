"use client";

import type { ElementType } from "react";
import { Bot, FileText, Megaphone, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressBar } from "@/components/ProgressBar";
import { QuarterCells, QuarterHeaders } from "@/components/QuarterCells";
import { StatusBadge } from "@/components/StatusBadge";
import { MetricCard, Panel } from "@/components/ui/primitives";
import {
  feedbackItems,
  pillars,
  resultMetrics,
  voiceReports,
} from "@/lib/program-data";
import { useProgramInitiatives } from "@/lib/program-store";
import { calendarQuarter, effectiveStatus } from "@/lib/quarters";
import type { ProgramPillarId } from "@/lib/types";

const pillarIcon: Record<ProgramPillarId, ElementType> = {
  research: Megaphone,
  productivity: ShieldAlert,
  "digital-learning": Bot,
};

export function DashboardView() {
  const { items: initiatives } = useProgramInitiatives();
  const now = calendarQuarter();
  const average = Math.round(
    initiatives.reduce((sum, item) => sum + item.score, 0) /
      Math.max(initiatives.length, 1),
  );
  const completed = initiatives.filter((item) => item.status === "completed").length;
  const delayed = initiatives.filter(
    (item) => effectiveStatus(item) === "delayed",
  ).length;

  return (
    <div>
      <PageHeader
        title="Самбар"
        subtitle="Судалгаа хөгжүүлэлтийн ерөнхий самбар — inspection-center загвартай нийцүүлсэн"
      />

      <section className="h-scroll mb-5 grid min-w-[520px] grid-cols-2 gap-2 sm:gap-3 lg:min-w-0 lg:grid-cols-4">
        <MetricCard
          label="ХШ хийсэн тоо"
          value={String(initiatives.length)}
          hint="Холбогдсон ажил"
          tone="brand"
        />
        <MetricCard
          label="Нийцэл"
          value={`${average}%`}
          hint="Дундаж явц"
          tone="ok"
        />
        <MetricCard
          label="Дууссан ажил"
          value={String(completed)}
          hint="Баталгаажсан үр дүн"
        />
        <MetricCard
          label="Эрсдэл"
          value={String(delayed)}
          hint="Хугацаа, нөөц шаардсан"
          tone="danger"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {pillars.map((pillar) => {
          const Icon = pillarIcon[pillar.id];
          const rows = initiatives.filter((item) => item.pillarId === pillar.id);
          const metrics = resultMetrics.filter((item) => item.pillarId === pillar.id);
          const reports = voiceReports.filter((item) => item.pillarId === pillar.id);

          return (
            <div key={pillar.id} className="min-w-0 space-y-4">
              <div className="h-scroll soft-scroll">
                <section className="min-w-[720px] rounded-md border border-[var(--border)] bg-white">
                  <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 rounded border border-[var(--border)] bg-slate-50 px-2 py-0.5 text-xs font-semibold text-[var(--fg)]">
                        {pillar.no}
                      </span>
                      <Icon size={16} className="shrink-0 text-[var(--brand)]" />
                      <div className="min-w-0">
                        <h2 className="text-sm font-semibold">{pillar.title}</h2>
                        <p className="text-xs text-[var(--muted)]">
                          {pillar.description}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-1">
                    <table className="min-w-[720px]">
                      <thead>
                        <tr>
                          <th className="w-8">№</th>
                          <th>Ажил</th>
                          <th>Хариуцах</th>
                          <th>Оноо</th>
                          <QuarterHeaders year={now.year} />
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((item) => (
                          <tr key={item.id}>
                            <td className="text-sm">{item.no}</td>
                            <td>
                              <div className="text-sm font-semibold">
                                {item.title}
                              </div>
                              <div className="mt-1 text-xs text-[var(--muted)]">
                                {item.department}
                              </div>
                            </td>
                            <td className="text-sm">{item.owner}</td>
                            <td className="w-24">
                              <div className="text-sm font-semibold">
                                {item.score}/{item.target}
                              </div>
                              <ProgressBar value={item.score} />
                            </td>
                            <QuarterCells item={item} />
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>

              <div className="h-scroll soft-scroll">
                <section className="min-w-[480px] rounded-md border border-[var(--border)] bg-white">
                  <div className="border-b border-[var(--border)] px-3 py-2">
                    <h3 className="text-sm font-semibold">
                      {pillar.no}.1 Туршилт, үр дүн
                    </h3>
                  </div>
                  <div className="space-y-3 p-3">
                    {metrics.length === 0 ? (
                      <div className="text-sm text-[var(--muted)]">
                        Одоогоор үзүүлэлт бүртгээгүй.
                      </div>
                    ) : (
                      metrics.map((metric) => (
                        <div key={metric.id}>
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="font-semibold">{metric.label}</span>
                            <span className="shrink-0 text-[var(--muted)]">
                              {metric.actual} / {metric.target}
                            </span>
                          </div>
                          <div className="mt-2">
                            <ProgressBar value={metric.progress} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>

              {pillar.no !== "3" ? (
                <div className="h-scroll soft-scroll">
                  <section className="min-w-[480px] rounded-md border border-[var(--border)] bg-white">
                    <div className="border-b border-[var(--border)] px-3 py-2">
                      <h3 className="text-sm font-semibold">
                        {pillar.no}.2 Судалгааны явц, тайлан
                      </h3>
                    </div>
                    <div className="space-y-2 p-3">
                      {reports.length === 0 ? (
                        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                          <FileText size={15} />
                          Тайлан бүртгэх боломжтой.
                        </div>
                      ) : (
                        reports.map((report) => (
                          <div
                            key={report.id}
                            className="rounded border border-[var(--border)] p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold">
                                  {report.no}. {report.title}
                                </div>
                                <div className="mt-1 text-xs text-[var(--muted)]">
                                  {report.participants} оролцогч ·{" "}
                                  {report.responsible} · {report.submittedAt}
                                </div>
                              </div>
                              <StatusBadge status={report.status} />
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>
                </div>
              ) : null}
            </div>
          );
        })}
      </section>

      <section className="h-scroll mt-5 grid min-w-[640px] gap-3 lg:grid-cols-3 lg:min-w-0">
        {feedbackItems.map((item, index) => (
          <Panel
            key={item.id}
            title={`${index === 0 ? "4" : `4.${index}`} ${item.title}`}
          >
            <div className="text-2xl font-semibold tabular-nums">{item.count}</div>
            <div className="mt-1 text-sm text-[var(--muted)]">
              Холбогдох нэгж: {item.department}
            </div>
            <div className="mt-4">
              <StatusBadge status={item.status} />
            </div>
          </Panel>
        ))}
      </section>
    </div>
  );
}
