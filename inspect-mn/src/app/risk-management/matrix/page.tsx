"use client";

import Link from "next/link";
import { RiskFrame } from "@/components/risk/RiskFrame";
import { ReportMatrix } from "@/components/reports/ReportMatrix";
import { ReportKpiCard } from "@/components/reports/ReportKpiCard";
import { RiskRegister } from "@/components/risk/RiskRegister";

export default function RiskMatrixPage() {
  return (
    <RiskFrame
      title="Эрсдэлийн матриц"
      description="Магадлал × нөлөөгөөр өндөр бүсийн дохиог ялгана. Баруун дээд — нэн түрүүнд шийдэх."
    >
      {({ data, loading }) => {
        const hot = (data?.items ?? []).filter((i) => i.likelihood * i.impact >= 16);
        return (
          <>
            <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <ReportKpiCard
                label="Матрицын нүд"
                value={String((data?.matrix ?? []).filter((c) => c.count > 0).length || (data ? 0 : "—"))}
                hint="Дохиотой нүд"
                tone="neutral"
              />
              <ReportKpiCard
                label="Улаан бүс"
                value={String(hot.length)}
                hint="Магадлал × нөлөө ≥ 16"
                tone={hot.length > 0 ? "bad" : "good"}
              />
              <ReportKpiCard
                label="Үлдэгдэл"
                value={data ? `${data.kpis.avgResidual}%` : "—"}
                hint="Дундаж үнэлгээ"
                tone="warn"
              />
            </section>
            <section className="mb-4 rounded-md border border-[var(--border)] bg-[var(--card)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
                <h2 className="text-sm font-semibold">Магадлал × нөлөө</h2>
                <Link href="/risk-management/register" className="text-xs text-[var(--brand)]">
                  Бүртгэл
                </Link>
              </div>
              <div className="max-w-md p-3">
                <ReportMatrix cells={data?.matrix ?? []} />
              </div>
            </section>
            <h2 className="mb-2 text-sm font-semibold">Улаан бүсийн дохио</h2>
            <RiskRegister
              items={hot}
              loading={loading}
              empty="Улаан бүсэд эрсдэл алга."
            />
          </>
        );
      }}
    </RiskFrame>
  );
}
