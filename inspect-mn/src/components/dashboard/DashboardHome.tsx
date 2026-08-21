"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import {
  GROUP_HINTS,
  GROUP_LABELS,
  MODULES,
  type ModuleGroup,
  type PlatformModule,
} from "@/lib/modules";
import { PageHeader } from "@/components/ui/PageHeader";

const GROUPS: ModuleGroup[] = ["duty", "result", "tools"];

const STAT_TONE = [
  "border-l-[var(--brand)]",
  "border-l-slate-400",
  "border-l-amber-500",
  "border-l-emerald-500",
  "border-l-sky-500",
  "border-l-violet-500",
  "border-l-rose-400",
  "border-l-teal-500",
] as const;

type DashKpi = {
  id: string;
  label: string;
  value: string;
  hint?: string;
};

type DashboardKpisResponse = {
  ok: boolean;
  scoped?: boolean;
  positionLinked?: boolean;
  position?: { id: string; name: string; bteg_id?: string | null } | null;
  kpis?: DashKpi[];
  message?: string;
  href?: string;
  hasJobDescription?: boolean;
  trend?: Array<{ at: string; score: number }>;
};

export function DashboardHome() {
  const [allowedIds, setAllowedIds] = useState<string[] | null>(null);
  const [roleLabel, setRoleLabel] = useState<string | null>(null);
  const [kpiState, setKpiState] = useState<DashboardKpisResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [accessRes, kpiRes] = await Promise.all([
          fetch("/api/me/access", { cache: "no-store" }),
          fetch("/api/me/dashboard-kpis", { cache: "no-store" }),
        ]);
        const access = await accessRes.json();
        const kpis = (await kpiRes.json()) as DashboardKpisResponse;
        if (cancelled) return;
        if (access.ok && Array.isArray(access.modules)) {
          setAllowedIds(access.modules);
          setRoleLabel(access.role_label ?? access.profile?.role_label ?? null);
        } else {
          setAllowedIds(["policy-compliance"]);
        }
        if (kpis.ok) setKpiState(kpis);
        else setKpiState({ ok: false, kpis: [], message: kpis.message });
      } catch {
        if (!cancelled) {
          setAllowedIds(["policy-compliance"]);
          setKpiState({
            ok: false,
            kpis: [],
            message: "KPI уншиж чадсангүй.",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const modulesByGroup = useMemo(() => {
    const allowed = new Set(allowedIds ?? []);
    const filter = (group: ModuleGroup) =>
      MODULES.filter((m) => m.group === group && allowed.has(m.id));
    return GROUPS.map((group) => ({
      group,
      items: filter(group),
    })).filter((g) => g.items.length > 0);
  }, [allowedIds]);

  const loading = allowedIds === null || kpiState === null;
  const kpis = kpiState?.kpis ?? [];
  const positionName = kpiState?.position?.name;

  return (
    <div>
      <PageHeader
        title="Платформын самбар"
        description={
          positionName
            ? `Ажлын байр: ${positionName}${roleLabel ? ` · ${roleLabel}` : ""}`
            : roleLabel
              ? `Таны эрх: ${roleLabel}. Зөвхөн танд нээлттэй модулиуд харагдана.`
              : "Зөвхөн таны role / эрхийн хүрээнд нээлттэй модулиуд харагдана."
        }
      />

      <section className="mb-5">
        {loading ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="h-[72px] animate-pulse rounded-md border border-[var(--border)] bg-[var(--surface-muted)]"
              />
            ))}
          </div>
        ) : kpis.length > 0 ? (
          <>
            <div className="mb-2 flex items-end justify-between gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                Миний журмын биелэлт
              </h2>
              {kpiState?.href ? (
                <Link
                  href={kpiState.href}
                  className="text-xs font-medium text-[var(--brand)] hover:underline"
                >
                  Дэлгэрэнгүй →
                </Link>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
              {kpis.map((stat, i) => (
                <div
                  key={stat.id}
                  className={`rounded-md border border-[var(--border)] border-l-4 bg-[var(--card)] p-3 ${STAT_TONE[i % STAT_TONE.length]}`}
                >
                  <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)] sm:text-[11px]">
                    {stat.label}
                  </div>
                  <div className="mt-1 text-xl font-semibold tabular-nums text-[var(--fg)] sm:text-2xl">
                    {stat.value}
                  </div>
                  {stat.hint ? (
                    <div className="mt-0.5 text-[10px] text-[var(--muted)]">
                      {stat.hint}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            {kpiState?.trend && kpiState.trend.length > 0 ? (
              <MiniScoreTrend data={kpiState.trend} />
            ) : null}
          </>
        ) : (
          <div className="rounded-md border border-[var(--border)] bg-[var(--card)] px-4 py-5 text-sm text-[var(--muted)]">
            {kpiState?.message ||
              "Таны ажлын байртай холбоотой KPI харагдахгүй байна."}
            {kpiState?.href ? (
              <>
                {" "}
                <Link
                  href={kpiState.href}
                  className="font-medium text-[var(--brand)] hover:underline"
                >
                  Журмын биелэлт
                </Link>
              </>
            ) : null}
          </div>
        )}
      </section>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-md border border-[var(--border)] bg-[var(--surface-muted)]"
            />
          ))}
        </div>
      ) : modulesByGroup.length === 0 ? (
        <div className="rounded-md border border-[var(--border)] bg-[var(--card)] px-4 py-8 text-center text-sm text-[var(--muted)]">
          Таны role-д харагдах модуль байхгүй байна. Админтай холбогдоно уу.
        </div>
      ) : (
        <div className="space-y-6">
          {modulesByGroup.map(({ group, items }) => (
            <ModuleGroupSection key={group} group={group} items={items} />
          ))}
        </div>
      )}
    </div>
  );
}

function MiniScoreTrend({
  data,
}: {
  data: Array<{ at: string; score: number }>;
}) {
  const scores = data.map((d) => d.score);
  const min = Math.min(...scores, 0);
  const max = Math.max(...scores, 100);
  const span = Math.max(max - min, 1);
  const w = 320;
  const h = 56;
  const points = data
    .map((d, i) => {
      const x = data.length === 1 ? w / 2 : (i / (data.length - 1)) * w;
      const y = h - ((d.score - min) / span) * (h - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="mb-2 text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
        Онооны хандлага
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-14 w-full text-[var(--brand)]"
        preserveAspectRatio="none"
        aria-hidden
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points}
        />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-[var(--muted)]">
        <span>{data[0]?.at}</span>
        <span>{data[data.length - 1]?.at}</span>
      </div>
    </div>
  );
}

function ModuleGroupSection({
  group,
  items,
}: {
  group: ModuleGroup;
  items: PlatformModule[];
}) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-semibold tracking-[0.08em] text-[var(--brand)]">
          {GROUP_LABELS[group]}
        </h2>
        <p className="text-xs text-[var(--muted)]">{GROUP_HINTS[group]}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((mod) => {
          const Icon = mod.icon;
          return (
            <Link
              key={mod.id}
              href={mod.href}
              className="group rounded-md border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-[var(--brand)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--brand)] text-white">
                    <Icon size={18} />
                  </div>
                  <div className="font-semibold text-[var(--fg)]">{mod.label}</div>
                </div>
                <ArrowUpRight
                  size={16}
                  className="text-[var(--muted)] transition group-hover:text-[var(--brand)]"
                />
              </div>
              <p className="mt-3 text-sm text-[var(--muted)]">{mod.description}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
