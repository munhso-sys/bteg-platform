"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ReportsFrame } from "@/components/reports/ReportsFrame";
import { ReportKpiCard } from "@/components/reports/ReportKpiCard";
import { ReportRowsTable } from "@/components/reports/ReportRowsTable";
import { ExportBar } from "@/components/reports/ExportBar";
import {
  LEVEL_LABELS,
  type ReportLevel,
  type PlatformReport,
} from "@/lib/reports/types";
import { cn } from "@/lib/cn";
import { kpiExportRows, signalExportRows } from "@/components/reports/reportLabels";

const LEVELS: ReportLevel[] = ["leadership", "dxshh", "unit", "module"];

function OperationsInner() {
  const params = useSearchParams();
  const raw = params.get("level");
  const level = LEVELS.includes(raw as ReportLevel)
    ? (raw as ReportLevel)
    : "dxshh";

  return (
    <ReportsFrame
      title="Түвшингийн самбар"
      description="Удирдлага, ДХШХ, нэгж, модуль гэсэн дөрвөн түвшинд үйл ажиллагааг хянана."
    >
      {({ data }) => <LevelBoards data={data} level={level} />}
    </ReportsFrame>
  );
}

function LevelBoards({
  data,
  level,
}: {
  data: PlatformReport | null;
  level: ReportLevel;
}) {
  const kpis = (data?.kpis ?? []).filter((k) => k.level === level);
  const rows = useMemo(() => {
    const all = data?.rows ?? [];
    if (level === "dxshh") {
      return all.filter(
        (r) =>
          r.status === "overdue" || r.value === "high" || r.value === "critical",
      );
    }
    if (level === "leadership") return all.slice(0, 12);
    return all;
  }, [data, level]);

  const hint =
    level === "leadership"
      ? "Удирдлагын хамрах хүрээ, үлдэгдэл эрсдэл, хүний нөөц."
      : level === "dxshh"
        ? "ДХШХ-ийн эрсдэл, гүйцэтгэл, хариу арга хэмжээ."
        : level === "unit"
          ? "Нэгжүүдийн дохио, гомдол, үлдэгдэл."
          : "ХШ, журам, СХ, дуу хоолойн модулийн үзүүлэлт.";

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5 print:hidden">
          {LEVELS.map((id) => (
            <Link
              key={id}
              href={`/report-analysis/operations?level=${id}`}
              className={cn(
                "shrink-0 rounded px-3 py-2 text-xs font-medium",
                level === id
                  ? "bg-[var(--brand)] text-white"
                  : "border border-[var(--border)] bg-[var(--card)] text-[var(--fg)]",
              )}
            >
              {LEVEL_LABELS[id]}
            </Link>
          ))}
        </div>
        <ExportBar
          filename={`tusun-${level}`}
          extraRows={[...kpiExportRows(kpis), [], ...signalExportRows(rows)]}
        />
      </div>

      <p className="mb-3 text-sm text-[var(--muted)]">{hint}</p>

      <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {kpis.map((k) => (
          <ReportKpiCard
            key={k.id}
            label={k.label}
            value={k.value}
            hint={k.hint}
            tone={k.tone}
          />
        ))}
      </section>

      {level === "unit" ? (
        <div className="mb-4 overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--card)]">
          <table>
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
                  <td className="tabular-nums">{u.residual}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {level === "module" ? (
        <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {(data?.bySystem ?? []).map((row) => (
            <div
              key={row.system}
              className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2"
            >
              <div className="text-[11px] uppercase tracking-wide text-[var(--muted)]">
                {row.system}
              </div>
              <div className="text-2xl font-semibold tabular-nums">{row.count}</div>
              <div className="text-xs text-[var(--muted)]">Өндөр {row.high}</div>
            </div>
          ))}
        </div>
      ) : null}

      <ReportRowsTable id="ops-rows" rows={rows} empty="Энэ түвшинд мөр алга." />
    </>
  );
}

export default function ReportOperationsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Ачааллаж байна…</p>}>
      <OperationsInner />
    </Suspense>
  );
}
