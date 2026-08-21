"use client";

import { SmartMineFrame } from "./SmartMineFrame";
import { SmartMineKpiCard } from "./SmartMineKpiCard";
import { formatNumber } from "@/lib/smartmine/numbers";

export function EquipmentClient() {
  return (
    <SmartMineFrame
      title="Equipment"
      description="Тоног төхөөрөмжийн downtime, MTTR, work order — public.v_maintenance_work_order_dashboard"
    >
      {({ data, loading }) => {
        const rows = data?.equipment ?? [];
        return (
          <>
            <section className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <SmartMineKpiCard
                label="Төхөөрөмж"
                value={data ? String(rows.length) : "—"}
                hint="Сонгосон интервал"
                tone="neutral"
              />
              <SmartMineKpiCard
                label="Top downtime"
                value={data?.maintenance.topEquipment ?? "—"}
                tone="warn"
              />
              <SmartMineKpiCard
                label="Нийт downtime"
                value={data ? formatNumber(data.maintenance.downtimeHours, 1) : "—"}
                unit="цаг"
                tone="bad"
              />
            </section>

            <section className="rounded-md border border-[var(--border)] bg-[var(--card)]">
              <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold">
                Төхөөрөмжийн жагсаалт
              </div>
              <div className="soft-scroll max-h-[36rem]">
                <table className="min-w-[860px]">
                  <thead>
                    <tr>
                      <th>Төхөөрөмж</th>
                      <th>Сектор</th>
                      <th>WO</th>
                      <th>Нээлттэй</th>
                      <th>Downtime</th>
                      <th>MTTR</th>
                      <th>Сүүлчийн өдөр</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-sm text-[var(--muted)]">
                          {loading ? "Ачаалж байна…" : "Өгөгдөл алга."}
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={row.machineId}>
                          <td className="font-medium">{row.machineName}</td>
                          <td>{row.sectorName}</td>
                          <td className="tabular-nums">{formatNumber(row.workOrders)}</td>
                          <td className="tabular-nums">{formatNumber(row.openWorkOrders)}</td>
                          <td className="tabular-nums">{formatNumber(row.downtimeHours, 1)} цаг</td>
                          <td className="tabular-nums">{formatNumber(row.mttrHours, 2)} цаг</td>
                          <td className="tabular-nums">{row.lastDay ?? "—"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        );
      }}
    </SmartMineFrame>
  );
}
