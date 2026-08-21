"use client";

import { DualAxisChart } from "./DualAxisChart";
import { SmartMineFrame } from "./SmartMineFrame";
import { SmartMineKpiCard } from "./SmartMineKpiCard";
import { formatNumber } from "@/lib/smartmine/numbers";

export function MaintenanceClient() {
  return (
    <SmartMineFrame
      title="Maintenance"
      description="Work order, downtime, MTTR — public.v_maintenance_work_order_dashboard"
    >
      {({ data, loading }) => {
        const sectors = data?.maintenance.bySector ?? [];
        const top = (data?.equipment ?? []).slice(0, 12);
        return (
          <>
            <section className="mb-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
              <SmartMineKpiCard
                label="Work orders"
                value={data ? formatNumber(data.maintenance.workOrders) : "—"}
                unit="WO"
                hint={loading ? "Ачаалж байна" : `${data?.rowCounts.maintenance ?? 0} мөр`}
                tone="neutral"
              />
              <SmartMineKpiCard
                label="Downtime"
                value={data ? formatNumber(data.maintenance.downtimeHours, 1) : "—"}
                unit="цаг"
                tone="warn"
              />
              <SmartMineKpiCard
                label="MTTR"
                value={data ? formatNumber(data.maintenance.mttrHours, 2) : "—"}
                unit="цаг"
                tone="neutral"
              />
              <SmartMineKpiCard
                label="Top equipment"
                value={data?.maintenance.topEquipment ?? "—"}
                tone="bad"
              />
            </section>

            <section className="mb-3 rounded-md border border-[var(--border)] bg-[var(--card)] p-3">
              <h2 className="text-sm font-semibold">MTTR / Downtime</h2>
              <DualAxisChart
                left={{ label: "MTTR", unit: "цаг", color: "var(--brand)" }}
                right={{ label: "Downtime", unit: "цаг", color: "#0284c7" }}
                points={(data?.maintenance.series ?? []).map((row) => ({
                  date: row.date,
                  left: row.mttrHours,
                  right: row.downtimeHours,
                }))}
              />
            </section>

            <div className="grid gap-3 lg:grid-cols-2">
              <section className="rounded-md border border-[var(--border)] bg-[var(--card)]">
                <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold">
                  Секторээр
                </div>
                <div className="soft-scroll max-h-[26rem]">
                <ul className="min-w-[30rem] divide-y divide-[var(--border)]">
                  {sectors.length === 0 ? (
                    <li className="px-3 py-4 text-sm text-[var(--muted)]">
                      {loading ? "Ачаалж байна…" : "Өгөгдөл алга."}
                    </li>
                  ) : (
                    sectors.map((row) => (
                      <li
                        key={row.sectorName}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate font-medium">{row.sectorName}</span>
                        <span className="shrink-0 tabular-nums text-[var(--muted)]">
                          {row.workOrders} WO · {formatNumber(row.downtimeHours, 1)} цаг
                        </span>
                      </li>
                    ))
                  )}
                </ul>
                </div>
              </section>

              <section className="rounded-md border border-[var(--border)] bg-[var(--card)]">
                <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold">
                  Хамгийн их downtime
                </div>
                <div className="soft-scroll max-h-[26rem]">
                <ul className="min-w-[30rem] divide-y divide-[var(--border)]">
                  {top.length === 0 ? (
                    <li className="px-3 py-4 text-sm text-[var(--muted)]">
                      {loading ? "Ачаалж байна…" : "Өгөгдөл алга."}
                    </li>
                  ) : (
                    top.map((row) => (
                      <li
                        key={row.machineId}
                        className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                      >
                        <span className="min-w-0 truncate font-medium">{row.machineName}</span>
                        <span className="shrink-0 tabular-nums text-[var(--muted)]">
                          {formatNumber(row.downtimeHours, 1)} цаг
                        </span>
                      </li>
                    ))
                  )}
                </ul>
                </div>
              </section>
            </div>
          </>
        );
      }}
    </SmartMineFrame>
  );
}
