"use client";

import Link from "next/link";
import { ReportKpiCard } from "@/components/reports/ReportKpiCard";
import { ReportMatrix } from "@/components/reports/ReportMatrix";
import { FolderTree } from "@/components/reports/FolderTree";
import type { RiskOverview } from "@/lib/risk/types";
import { buildRiskTree } from "@/lib/risk/tree";
import { cn } from "@/lib/cn";

const TOOLS = [
  { href: "/risk-management/register", title: "Бүртгэл", text: "Бүх дохио, шүүлтүүр, засварын дэлгэрэнгүй" },
  { href: "/risk-management/matrix", title: "Матриц", text: "Магадлал × нөлөөгөөр анхаарах бүс" },
  { href: "/risk-management/work", title: "Засвар", text: "Хэтэрсэн, явж буй, төлөвлөгөөгүй ажил" },
  { href: "/risk-management/sources", title: "Эх үүсвэр", text: "ХШ, журам, СХ, дуу хоолой" },
  { href: "/risk-management/tree", title: "Хавтас", text: "Дэлгэх / хураах мод, дэд хуудас" },
  { href: "/report-analysis", title: "Тайлан", text: "Платформын нэгдсэн шинжилгээ" },
];

export function RiskDashboard({
  data,
  loading,
}: {
  data: RiskOverview | null;
  loading: boolean;
}) {
  const tree = data ? buildRiskTree(data) : [];

  return (
    <>
      <section className="mb-4 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-5">
        <ReportKpiCard
          label="Идэвхтэй эрсдэл"
          value={String(data?.kpis.active ?? "—")}
          hint="Модулиудаас ирсэн дохио"
          tone="warn"
        />
        <ReportKpiCard
          label="Өндөр зэрэглэл"
          value={String(data?.kpis.high ?? "—")}
          hint="Нэн түрүүнд шийдэх"
          tone="bad"
        />
        <ReportKpiCard
          label="Засвар явж буй"
          value={String(data?.kpis.inProgress ?? "—")}
          hint={`${data?.kpis.coveragePercent ?? 0}% хамрагдалт`}
          tone="neutral"
        />
        <ReportKpiCard
          label="Хугацаа хэтэрсэн"
          value={String(data?.kpis.overdue ?? "—")}
          hint="Гүйцэтгэл хоцорсон"
          tone={data && data.kpis.overdue > 0 ? "bad" : "good"}
        />
        <ReportKpiCard
          label="Үлдэгдэл эрсдэл"
          value={data ? `${data.kpis.avgResidual}%` : "—"}
          hint="Дундаж үнэлгээ"
          tone="warn"
        />
      </section>

      <section className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {TOOLS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-sm hover:border-[var(--brand)]"
          >
            <div className="font-semibold">{t.title}</div>
            <div className="mt-1 text-[var(--muted)]">{t.text}</div>
          </Link>
        ))}
      </section>

      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(16rem,0.85fr)]">
        <section className="rounded-md border border-[var(--border)] bg-[var(--card)]">
          <div className="border-b border-[var(--border)] px-3 py-2">
            <h2 className="text-sm font-semibold text-[var(--fg)]">Эх үүсвэрээр</h2>
          </div>
          <div className="grid gap-2 p-3 sm:grid-cols-2">
            {(data?.bySource ?? []).map((row) => (
              <Link
                key={row.source}
                href={`/risk-management/sources?source=${row.source}`}
                className={cn(
                  "rounded-md border border-[var(--border)] px-3 py-2.5 text-left hover:border-[var(--brand)]",
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
              </Link>
            ))}
          </div>
        </section>
        <section className="rounded-md border border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
            <h2 className="text-sm font-semibold text-[var(--fg)]">Магадлал × нөлөө</h2>
            <Link href="/risk-management/matrix" className="text-xs text-[var(--brand)]">
              Нээх
            </Link>
          </div>
          <div className="p-3">
            <ReportMatrix cells={data?.matrix ?? []} />
          </div>
        </section>
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <section className="rounded-md border border-[var(--border)] bg-[var(--card)]">
          <div className="border-b border-[var(--border)] px-3 py-2">
            <h2 className="text-sm font-semibold text-[var(--fg)]">Дүгнэлт</h2>
          </div>
          <ul className="grid gap-1 p-3 text-sm">
            {(data?.conclusion ?? (loading ? ["Тооцоолж байна…"] : [])).map((line) => (
              <li
                key={line}
                className="rounded border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-[var(--fg)]"
              >
                {line}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-md border border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
            <h2 className="text-sm font-semibold">Хавтас</h2>
            <Link href="/risk-management/tree" className="text-xs text-[var(--brand)]">
              Бүгдийг харах
            </Link>
          </div>
          <div className="soft-scroll max-h-80 p-2">
            <FolderTree nodes={tree} openMode="smart" />
          </div>
        </section>
      </div>
    </>
  );
}
