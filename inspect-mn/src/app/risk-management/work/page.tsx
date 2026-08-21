"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { RiskFrame } from "@/components/risk/RiskFrame";
import { RiskRegister } from "@/components/risk/RiskRegister";
import { ReportKpiCard } from "@/components/reports/ReportKpiCard";
import { useRiskSearch } from "@/components/risk/useRiskSearch";
import { isUnplanned } from "@/lib/risk/filter";
import type { RiskOverview, RiskSignal } from "@/lib/risk/types";
import { cn } from "@/lib/cn";

const STATUSES = [
  { id: "all", label: "Бүгд" },
  { id: "overdue", label: "Хугацаа хэтэрсэн" },
  { id: "in_progress", label: "Хийгдэж байгаа" },
  { id: "unplanned", label: "Төлөвлөгөөгүй" },
] as const;

type WorkStatus = (typeof STATUSES)[number]["id"];

function pick(items: RiskSignal[], status: WorkStatus) {
  if (status === "overdue") return items.filter((i) => i.status === "overdue");
  if (status === "in_progress") return items.filter((i) => i.status === "in_progress");
  if (status === "unplanned") return items.filter(isUnplanned);
  return items.filter(
    (i) => i.status === "overdue" || i.status === "in_progress" || isUnplanned(i),
  );
}

function WorkBody({
  data,
  loading,
}: {
  data: RiskOverview | null;
  loading: boolean;
}) {
  const { params, set } = useRiskSearch();
  const raw = params.get("status");
  const status: WorkStatus = STATUSES.some((s) => s.id === raw)
    ? (raw as WorkStatus)
    : "all";
  const items = data?.items ?? [];
  const overdue = useMemo(() => items.filter((i) => i.status === "overdue"), [items]);
  const inProgress = useMemo(
    () => items.filter((i) => i.status === "in_progress"),
    [items],
  );
  const unplanned = useMemo(() => items.filter(isUnplanned), [items]);
  const shown = pick(items, status);

  return (
    <>
      <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <ReportKpiCard
          label="Хэтэрсэн"
          value={String(overdue.length)}
          hint="Хугацаа хэтэрсэн засвар"
          tone={overdue.length > 0 ? "bad" : "good"}
        />
        <ReportKpiCard
          label="Явж буй"
          value={String(inProgress.length)}
          hint={`${data?.kpis.coveragePercent ?? 0}% хамрагдалт`}
          tone="neutral"
        />
        <ReportKpiCard
          label="Төлөвлөгөөгүй"
          value={String(unplanned.length)}
          hint="Хариуцагч/явцгүй"
          tone={unplanned.length > 0 ? "warn" : "good"}
        />
      </section>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => set({ status: s.id })}
            className={cn(
              "shrink-0 rounded px-3 py-2 text-xs font-medium",
              status === s.id
                ? "bg-[var(--brand)] text-white"
                : "border border-[var(--border)] bg-[var(--card)] text-[var(--fg)]",
            )}
          >
            {s.label}
          </button>
        ))}
        <Link href="/risk-management/register" className="btn ml-auto text-xs">
          Бүртгэл
        </Link>
      </div>

      <RiskRegister
        items={shown}
        loading={loading}
        empty="Энэ төлөвт засвар алга."
      />
    </>
  );
}

function WorkInner() {
  return (
    <RiskFrame
      title="Засвар ажил"
      description="Хугацаа хэтэрсэн, хийгдэж байгаа, төлөвлөгөөгүй эрсдэлийн ажлыг ангилна."
    >
      {({ data, loading }) => <WorkBody data={data} loading={loading} />}
    </RiskFrame>
  );
}

export default function RiskWorkPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--muted)]">Ачааллаж байна…</p>}>
      <WorkInner />
    </Suspense>
  );
}
