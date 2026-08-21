"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ReportsFrame } from "@/components/reports/ReportsFrame";
import { ReportKpiCard } from "@/components/reports/ReportKpiCard";
import { ExportBar } from "@/components/reports/ExportBar";
import { LEVEL_LABELS, type ReportLevel } from "@/lib/reports/types";
import { cn } from "@/lib/cn";
import { kpiExportRows } from "@/components/reports/reportLabels";

const LEVELS: Array<"all" | ReportLevel> = [
  "all",
  "leadership",
  "dxshh",
  "unit",
  "module",
];

function KpisInner() {
  const params = useSearchParams();
  const levelParam = params.get("level");
  const level: "all" | ReportLevel = LEVELS.includes(
    levelParam as (typeof LEVELS)[number],
  )
    ? (levelParam as (typeof LEVELS)[number])
    : "all";

  return (
    <ReportsFrame
      title="KPI сан"
      description="Платформын олон системийн үзүүлэлтийг удирдлага, ДХШХ, нэгж, модуль гэсэн дөрвөн түвшинд харна."
    >
      {({ data }) => {
        const items = (data?.kpis ?? []).filter(
          (k) => level === "all" || k.level === level,
        );
        const systems = Array.from(new Set(items.map((k) => k.system)));
        return <KpiLibrary items={items} systems={systems} level={level} />;
      }}
    </ReportsFrame>
  );
}

function KpiLibrary({
  items,
  systems,
  level,
}: {
  items: {
    id: string;
    label: string;
    value: string;
    hint: string;
    tone: "neutral" | "good" | "warn" | "bad";
    level: ReportLevel;
    system: string;
    folder: string[];
  }[];
  systems: string[];
  level: "all" | ReportLevel;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, typeof items>();
    for (const item of items) {
      const key = item.folder.join(" / ") || item.system;
      const list = map.get(key) ?? [];
      list.push(item);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [items]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {LEVELS.map((id) => (
            <Link
              key={id}
              href={id === "all" ? "/report-analysis/kpis" : `/report-analysis/kpis?level=${id}`}
              className={cn(
                "shrink-0 rounded px-3 py-2 text-xs font-medium",
                level === id
                  ? "bg-[var(--brand)] text-white"
                  : "border border-[var(--border)] bg-[var(--card)] text-[var(--fg)]",
              )}
            >
              {id === "all" ? "Бүгд" : LEVEL_LABELS[id]}
            </Link>
          ))}
        </div>
        <ExportBar
          filename={`kpi-${level}`}
          extraRows={kpiExportRows(items)}
        />
      </div>

      <p className="mb-3 text-xs text-[var(--muted)]">
        {items.length} үзүүлэлт · {systems.length} систем
      </p>

      {grouped.map(([folder, kpis]) => (
        <section key={folder} className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-[var(--fg)]">{folder}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            {kpis.map((k) => (
              <ReportKpiCard
                key={k.id}
                label={k.label}
                value={k.value}
                hint={`${LEVEL_LABELS[k.level]} · ${k.hint}`}
                tone={k.tone}
              />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

export default function ReportKpisPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Ачааллаж байна…</p>}>
      <KpisInner />
    </Suspense>
  );
}
