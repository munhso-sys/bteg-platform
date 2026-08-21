"use client";

import { Suspense, useCallback, useMemo } from "react";
import { RiskFrame } from "@/components/risk/RiskFrame";
import { RiskFilterBar } from "@/components/risk/RiskFilterBar";
import { RiskRegister } from "@/components/risk/RiskRegister";
import { useRiskSearch } from "@/components/risk/useRiskSearch";
import {
  filterRiskItems,
  parseRiskFilter,
  parseRiskSource,
} from "@/lib/risk/filter";
import type { RiskOverview } from "@/lib/risk/types";

function RegisterBody({
  data,
  loading,
}: {
  data: RiskOverview | null;
  loading: boolean;
}) {
  const { params, set } = useRiskSearch();
  const filter = parseRiskFilter(params.get("filter"));
  const source = parseRiskSource(params.get("source"));
  const query = params.get("q") ?? "";
  const unit = params.get("unit") ?? "";
  const selectedId = params.get("id");

  const items = useMemo(
    () =>
      filterRiskItems(data?.items ?? [], {
        source,
        filter,
        query,
        unit,
      }),
    [data, source, filter, query, unit],
  );

  const onSelect = useCallback((id: string) => set({ id }), [set]);

  return (
    <>
      {unit ? (
        <p className="mb-3 text-xs text-[var(--muted)]">Нэгж: {unit}</p>
      ) : null}
      <RiskFilterBar
        filter={filter}
        source={source}
        query={query}
        onFilter={(id) => set({ filter: id })}
        onSource={(id) => set({ source: id })}
        onQuery={(q) => set({ q })}
      />
      <RiskRegister
        items={items}
        loading={loading}
        selectedId={selectedId}
        onSelect={onSelect}
        empty={loading ? "Ачааллаж байна…" : "Шүүлтүүрт тохирох эрсдэл алга."}
      />
    </>
  );
}

function RegisterInner() {
  return (
    <RiskFrame
      title="Эрсдэлийн бүртгэл"
      description="Бүх дохиог зэрэглэл, эх үүсвэр, нэгжээр шүүж, засварын явцыг харна."
    >
      {({ data, loading }) => <RegisterBody data={data} loading={loading} />}
    </RiskFrame>
  );
}

export default function RiskRegisterPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Ачааллаж байна…</p>}>
      <RegisterInner />
    </Suspense>
  );
}
