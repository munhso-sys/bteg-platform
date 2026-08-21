"use client";

import type { ReactNode } from "react";
import { DualAxisChart } from "./DualAxisChart";
import { ProcessingSummaryPanel } from "./ProcessingSummaryPanel";
import { ReasonToolBlock } from "./ReasonToolBlock";
import { SmartMineFrame } from "./SmartMineFrame";
import { SmartMineKpiCard } from "./SmartMineKpiCard";
import { cn } from "@/lib/cn";
import { formatNumber } from "@/lib/smartmine/numbers";

const PROCESSING_LEFT = {
  label: "Ore Feed",
  unit: "t",
  color: "var(--brand)",
};
const PROCESSING_RIGHT = {
  label: "Concentrate",
  unit: "t",
  color: "#0284c7",
};
const MAINT_LEFT = { label: "MTTR", unit: "цаг", color: "var(--brand)" };
const MAINT_RIGHT = { label: "Downtime", unit: "цаг", color: "#0284c7" };

export function SmartMineDashboardClient() {
  return (
    <SmartMineFrame
      title="SmartMine"
      description="Боловсруулалт, засвар, MTTR / downtime — canonical view-оос."
    >
      {({ data, loading, from, to }) =>
        loading && !data ? (
          <DashboardSkeleton />
        ) : (
          <>
            <section className="mb-3">
              <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                Processing KPI
              </h2>
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                <SmartMineKpiCard
                  label="Ore feed"
                  value={data ? formatNumber(data.processing.oreFeedTons, 1) : "—"}
                  unit="т"
                  hint="v_processing_dashboard"
                  tone="neutral"
                />
                <SmartMineKpiCard
                  label="Concentrate"
                  value={
                    data ? formatNumber(data.processing.concentrateTons, 1) : "—"
                  }
                  unit="т"
                  hint="Нийт concentrate"
                  tone="good"
                />
                <SmartMineKpiCard
                  label="Recovery"
                  value={
                    data ? formatNumber(data.processing.recoveryPercent, 1) : "—"
                  }
                  unit="%"
                  hint="Дундаж recovery"
                  tone={
                    data &&
                    data.processing.recoveryPercent > 0 &&
                    data.processing.recoveryPercent < 85
                      ? "bad"
                      : "good"
                  }
                />
                <SmartMineKpiCard
                  label="Processing days"
                  value={data ? String(data.processing.processingDays) : "—"}
                  unit="өдөр"
                  hint={`${from} → ${to}`}
                  tone="neutral"
                />
              </div>
            </section>

            <ChartAndSide
              className="mb-3"
              chart={
                <ChartCard
                  title="Processing / Concentrate"
                  hint="Зүүн тэнхлэг Ore Feed t, баруун тэнхлэг Concentrate t. 0-ээс албагүй."
                >
                  <DualAxisChart
                    compact
                    left={PROCESSING_LEFT}
                    right={PROCESSING_RIGHT}
                    points={(data?.processingTrend ?? []).map((row) => ({
                      date: row.date,
                      left: row.oreFeedTonnes,
                      right: row.concentrateTonnes,
                    }))}
                  />
                </ChartCard>
              }
              side={
                <ProcessingSummaryPanel
                  summary={data?.processingSummary ?? null}
                />
              }
            />

            <section className="mb-3">
              <h2 className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                Maintenance KPI
              </h2>
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                <SmartMineKpiCard
                  label="Work orders"
                  value={data ? formatNumber(data.maintenance.workOrders) : "—"}
                  unit="WO"
                  hint="v_maintenance_work_order_dashboard"
                  tone="neutral"
                />
                <SmartMineKpiCard
                  label="Downtime hours"
                  value={
                    data ? formatNumber(data.maintenance.downtimeHours, 1) : "—"
                  }
                  unit="цаг"
                  hint="Нийт зогсолт"
                  tone={data && data.maintenance.downtimeHours > 1000 ? "bad" : "warn"}
                />
                <SmartMineKpiCard
                  label="MTTR"
                  value={data ? formatNumber(data.maintenance.mttrHours, 2) : "—"}
                  unit="цаг"
                  hint="Дундаж засвар"
                  tone={data && data.maintenance.mttrHours > 4 ? "warn" : "good"}
                />
                <SmartMineKpiCard
                  label="Top downtime equipment"
                  value={data?.maintenance.topEquipment ?? "—"}
                  hint="Хамгийн их зогсолт"
                  tone="warn"
                />
              </div>
            </section>

            <ChartAndSide
              chart={
                <ChartCard
                  title="MTTR / Downtime"
                  hint="Зүүн тэнхлэг MTTR цаг, баруун тэнхлэг downtime цаг. 0-ээс албагүй."
                >
                  <DualAxisChart
                    compact
                    left={MAINT_LEFT}
                    right={MAINT_RIGHT}
                    points={(data?.maintenance.series ?? []).map((row) => ({
                      date: row.date,
                      left: row.mttrHours,
                      right: row.downtimeHours,
                    }))}
                  />
                </ChartCard>
              }
              side={
                <ReasonToolBlock
                  reasons={data?.reasons ?? []}
                  from={from}
                  to={to}
                  compact
                />
              }
            />
          </>
        )
      }
    </SmartMineFrame>
  );
}

function ChartAndSide({
  chart,
  side,
  className,
}: {
  chart: ReactNode;
  side: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid items-stretch gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(17rem,0.85fr)]",
        className,
      )}
    >
      <div className="min-w-0">{chart}</div>
      <div className="relative min-h-0 min-w-0 overflow-hidden max-xl:h-[22rem]">
        <div className="h-full min-h-0 xl:absolute xl:inset-0">{side}</div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <section className="h-full rounded-md border border-[var(--border)] bg-[var(--card)] p-3">
      <h2 className="text-sm font-semibold">{title}</h2>
      <p className="mb-1.5 text-[11px] text-[var(--muted)]">{hint}</p>
      {children}
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="h-[76px] animate-pulse rounded-md border border-[var(--border)] bg-[var(--surface-muted)]"
        />
      ))}
    </div>
  );
}
