"use client";

import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Eye,
  Filter,
  ListTree,
  PlayCircle,
  Rocket,
} from "lucide-react";
import { RESPONSIBILITY_SHORT } from "@/lib/constants";
import type { ResponsibilityType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/ui/primitives";
import {
  PositionObligationsTree,
  type ObligationRow,
} from "./position-obligations-tree";

const DUTY_KPIS: Array<{
  type: ResponsibilityType;
  countKey: "implementation" | "monitoring" | "verification" | "deployment";
  Icon: typeof PlayCircle;
}> = [
  { type: "IMPLEMENTATION", countKey: "implementation", Icon: PlayCircle },
  { type: "MONITORING", countKey: "monitoring", Icon: Eye },
  { type: "VERIFICATION", countKey: "verification", Icon: BadgeCheck },
  { type: "DEPLOYMENT", countKey: "deployment", Icon: Rocket },
];

function FilterableKpi({
  label,
  value,
  active,
  onFilter,
  icon,
}: {
  label: string;
  value: number;
  active?: boolean;
  onFilter?: () => void;
  icon?: React.ReactNode;
}) {
  const clickable = Boolean(onFilter);
  return (
    <div
      className={cn(
        "rounded border bg-[var(--card)] px-3 py-2",
        active
          ? "border-[var(--brand)] ring-1 ring-[var(--brand)]/30"
          : "border-[var(--border)]",
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
          {label}
        </div>
        {clickable ? (
          <button
            type="button"
            onClick={onFilter}
            title={
              active
                ? "Шүүлтийг цуцлах"
                : `${label} үүргийн төлөвөөр шүүх`
            }
            aria-pressed={active}
            aria-label={`${label} үүргийн төлөвөөр шүүх`}
            className={cn(
              "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border transition-colors",
              active
                ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                : "border-slate-200 bg-slate-50 text-slate-600 hover:border-[var(--brand)] hover:text-[var(--brand)]",
            )}
          >
            {icon ?? <Filter size={14} />}
          </button>
        ) : null}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums leading-snug sm:text-2xl">
        {value}
      </div>
    </div>
  );
}

export function PositionObligationsSection({
  obligations,
  counts,
}: {
  obligations: ObligationRow[];
  counts: {
    clauses: number;
    policies: number;
    implementation: number;
    monitoring: number;
    verification: number;
    deployment: number;
  };
}) {
  const [dutyFilter, setDutyFilter] = useState<ResponsibilityType | null>(
    null,
  );

  const filtered = useMemo(() => {
    if (!dutyFilter) return obligations;
    return obligations.filter(
      (row) => row.link.responsibility_type === dutyFilter,
    );
  }, [obligations, dutyFilter]);

  function toggleDuty(type: ResponsibilityType) {
    setDutyFilter((current) => (current === type ? null : type));
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <FilterableKpi
          label="Зүйл"
          value={counts.clauses}
          active={dutyFilter === null}
          onFilter={() => setDutyFilter(null)}
          icon={<ListTree size={14} />}
        />
        <FilterableKpi label="Журам" value={counts.policies} />
        {DUTY_KPIS.map(({ type, countKey, Icon }) => (
          <FilterableKpi
            key={type}
            label={RESPONSIBILITY_SHORT[type]}
            value={counts[countKey]}
            active={dutyFilter === type}
            onFilter={() => toggleDuty(type)}
            icon={<Icon size={14} />}
          />
        ))}
      </div>

      <Panel title="Журмын үүрэг">
        <p className="mb-2 text-xs text-slate-500">
          Энэ ажлын байрт шууд холбогдсон заалтын үүрэг (
          {counts.policies} журам · {counts.clauses} заалт)
          {dutyFilter ? (
            <>
              {" · "}
              <span className="font-medium text-slate-700">
                шүүлт: {RESPONSIBILITY_SHORT[dutyFilter]}
              </span>
              {" · "}
              <button
                type="button"
                className="underline hover:no-underline"
                onClick={() => setDutyFilter(null)}
              >
                бүгдийг харах
              </button>
            </>
          ) : null}
          .
        </p>
        <div className="min-w-0 overflow-x-auto">
          <PositionObligationsTree rows={filtered} />
        </div>
      </Panel>
    </div>
  );
}
