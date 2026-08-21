"use client";

import { SmartMineFrame } from "./SmartMineFrame";
import { SmartMineKpiCard } from "./SmartMineKpiCard";
import { formatNumber } from "@/lib/smartmine/numbers";

export function ProcessingClient() {
  return (
    <SmartMineFrame
      title="Processing"
      description="Ore feed, concentrate, recovery — public.v_processing_dashboard"
    >
      {({ data, loading }) => {
        const rows = data?.processing.daily.slice(0, 80) ?? [];
        const plants = data?.processing.plants ?? [];
        return (
          <>
            <section className="mb-3 grid grid-cols-2 gap-2 xl:grid-cols-4">
              <SmartMineKpiCard
                label="Ore feed"
                value={data ? formatNumber(data.processing.oreFeedTons, 1) : "—"}
                unit="т"
                hint={loading ? "Ачаалж байна" : `${data?.rowCounts.processing ?? 0} мөр`}
                tone="neutral"
              />
              <SmartMineKpiCard
                label="Concentrate"
                value={data ? formatNumber(data.processing.concentrateTons, 1) : "—"}
                unit="т"
                tone="good"
              />
              <SmartMineKpiCard
                label="Recovery"
                value={data ? formatNumber(data.processing.recoveryPercent, 1) : "—"}
                unit="%"
                tone="good"
              />
              <SmartMineKpiCard
                label="Processing days"
                value={data ? String(data.processing.processingDays) : "—"}
                unit="өдөр"
                tone="neutral"
              />
            </section>

            <section className="mb-4 rounded-md border border-[var(--border)] bg-[var(--card)]">
              <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold">
                Үйлдвэрээр
              </div>
              <div className="soft-scroll max-h-[24rem]">
                <table className="min-w-[640px]">
                  <thead>
                    <tr>
                      <th>Plant</th>
                      <th>Ore feed</th>
                      <th>Concentrate</th>
                      <th>Recovery</th>
                      <th>Өдөр</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plants.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-sm text-[var(--muted)]">
                          {loading ? "Ачаалж байна…" : "Өгөгдөл алга."}
                        </td>
                      </tr>
                    ) : (
                      plants.map((row) => (
                        <tr key={row.plantName}>
                          <td className="font-medium">{row.plantName}</td>
                          <td className="tabular-nums">{formatNumber(row.oreFeedTons, 1)} т</td>
                          <td className="tabular-nums">{formatNumber(row.concentrateTons, 1)} т</td>
                          <td className="tabular-nums">{formatNumber(row.recoveryPercent, 1)}%</td>
                          <td className="tabular-nums">{row.processingDays}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-md border border-[var(--border)] bg-[var(--card)]">
              <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold">
                Өдрийн мөр
              </div>
              <div className="soft-scroll max-h-[32rem]">
                <table className="min-w-[720px]">
                  <thead>
                    <tr>
                      <th>Огноо</th>
                      <th>Plant</th>
                      <th>Ore feed</th>
                      <th>Concentrate</th>
                      <th>Recovery</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-sm text-[var(--muted)]">
                          {loading ? "Ачаалж байна…" : "Өгөгдөл алга."}
                        </td>
                      </tr>
                    ) : (
                      rows.map((row) => (
                        <tr key={`${row.date}-${row.plantName}`}>
                          <td className="tabular-nums">{row.date}</td>
                          <td>{row.plantName}</td>
                          <td className="tabular-nums">{formatNumber(row.oreFeedTons, 1)}</td>
                          <td className="tabular-nums">{formatNumber(row.concentrateTons, 1)}</td>
                          <td className="tabular-nums">{formatNumber(row.recoveryPercent, 1)}%</td>
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
