"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { RiskFrame } from "@/components/risk/RiskFrame";
import { RiskRegister } from "@/components/risk/RiskRegister";
import { useRiskSearch } from "@/components/risk/useRiskSearch";
import { parseRiskSource, RISK_SOURCE_LABEL } from "@/lib/risk/filter";
import type { RiskOverview } from "@/lib/risk/types";
import { cn } from "@/lib/cn";

function SourcesBody({
  data,
  loading,
}: {
  data: RiskOverview | null;
  loading: boolean;
}) {
  const { params, set } = useRiskSearch();
  const source = parseRiskSource(params.get("source"));
  const items = useMemo(() => {
    const all = data?.items ?? [];
    if (source === "all") return all;
    return all.filter((i) => i.source === source);
  }, [data, source]);

  return (
    <>
      <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {(data?.bySource ?? []).map((row) => (
          <button
            key={row.source}
            type="button"
            onClick={() => set({ source: row.source })}
            className={cn(
              "rounded-md border px-3 py-2.5 text-left",
              source === row.source
                ? "border-[var(--brand)] bg-[var(--surface-muted)]"
                : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--brand)]",
            )}
          >
            <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
              {row.label}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{row.count}</div>
            <div className="mt-1 text-xs text-[var(--muted)]">
              Өндөр {row.highCount} · Явж буй {row.inProgressCount} · Хэтэрсэн{" "}
              {row.overdueCount}
            </div>
          </button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          {source === "all" ? "Бүх эх үүсвэр" : RISK_SOURCE_LABEL[source]}
        </h2>
        <div className="flex gap-2">
          {source !== "all" ? (
            <button type="button" className="btn text-xs" onClick={() => set({ source: "all" })}>
              Бүгд
            </button>
          ) : null}
          <Link
            href={
              source === "all"
                ? "/risk-management/register"
                : `/risk-management/register?source=${source}`
            }
            className="btn text-xs"
          >
            Бүртгэл
          </Link>
        </div>
      </div>
      <RiskRegister
        items={items}
        loading={loading}
        empty="Энэ эх үүсвэрт дохио алга."
      />
    </>
  );
}

function SourcesInner() {
  return (
    <RiskFrame
      title="Эх үүсвэр"
      description="Хяналт шалгалт, журмын биелэлт, судалгаа хөгжүүлэлт, ажилтны дуу хоолойн эрсдэлийг тусад нь харна."
    >
      {({ data, loading }) => <SourcesBody data={data} loading={loading} />}
    </RiskFrame>
  );
}

export default function RiskSourcesPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Ачааллаж байна…</p>}>
      <SourcesInner />
    </Suspense>
  );
}
