"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart3,
  Database,
  FileText,
  Layers,
  Loader2,
  RefreshCw,
  Split,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/cn";
import type { GlossaryInsights } from "@/lib/glossary/insights";
import type { GlossaryMeta } from "@/lib/glossary/types";

type InsightsPayload = {
  ok: boolean;
  canEdit?: boolean;
  meta?: GlossaryMeta;
  insights?: GlossaryInsights;
  error?: string;
};

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-[var(--fg)]">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

function BarList({
  items,
  max,
}: {
  items: Array<{ label: string; value: number }>;
  max: number;
}) {
  const ceiling = Math.max(max, 1);
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.label} className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2">
          <span className="text-xs font-medium text-[var(--muted)]">
            {item.label}
          </span>
          <div className="h-2.5 overflow-hidden rounded-full bg-[var(--bg)]">
            <div
              className="h-full rounded-full bg-[var(--brand)] transition-all"
              style={{ width: `${Math.round((item.value / ceiling) * 100)}%` }}
            />
          </div>
          <span className="text-right text-xs text-[var(--muted)]">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function UsageDonut({
  buckets,
}: {
  buckets: GlossaryInsights["usageLevels"];
}) {
  const total = buckets.reduce((sum, b) => sum + b.count, 0) || 1;
  const colors = ["#0f766e", "#0284c7", "#d97706", "#94a3b8"];
  const segments = buckets.reduce<
    Array<GlossaryInsights["usageLevels"][number] & {
      pct: number;
      start: number;
      color: string;
    }>
  >((items, bucket, index) => {
    const pct = (bucket.count / total) * 100;
    const start = items.reduce((sum, item) => sum + item.pct, 0);
    return [
      ...items,
      { ...bucket, pct, start, color: colors[index % colors.length] },
    ];
  }, []);

  const gradient = segments
    .map((seg) => `${seg.color} ${seg.start}% ${seg.start + seg.pct}%`)
    .join(", ");

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <div
        className="h-36 w-36 shrink-0 rounded-full"
        style={{
          background: `conic-gradient(${gradient})`,
          boxShadow: "inset 0 0 0 28px var(--card)",
        }}
        aria-hidden
      />
      <div className="w-full space-y-2">
        {segments.map((seg) => (
          <div key={seg.level} className="flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: seg.color }}
              />
              <span>{seg.label}</span>
            </div>
            <span className="text-[var(--muted)]">
              {seg.count} ({Math.round(seg.pct)}%)
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GlossaryDatabaseClient() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState<GlossaryMeta | null>(null);
  const [insights, setInsights] = useState<GlossaryInsights | null>(null);
  const [selectedHomonym, setSelectedHomonym] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [selectedUsage, setSelectedUsage] = useState<number | null>(null);

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/glossary/insights", { cache: "no-store" });
      const data = (await res.json()) as InsightsPayload;
      if (!res.ok || !data.ok || !data.insights) {
        throw new Error(data.error ?? "Мэдээлэл ачаалахад алдаа");
      }
      setMeta(data.meta ?? null);
      setInsights(data.insights);
      setSelectedHomonym(data.insights.homonyms[0]?.key ?? null);
      setSelectedSource(data.insights.sourceDocuments[0]?.policyId ?? null);
      setSelectedUsage(data.insights.usageLevels[0]?.level ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Мэдээлэл ачаалахад алдаа");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-sm text-[var(--muted)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Платформ хайлт хийж байна...
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
        {error || "Мэдээлэл олдсонгүй"}
      </div>
    );
  }

  const activeHomonym =
    insights.homonyms.find((h) => h.key === selectedHomonym) ??
    insights.homonyms[0] ??
    null;
  const activeSource =
    insights.sourceDocuments.find((s) => s.policyId === selectedSource) ??
    insights.sourceDocuments[0] ??
    null;
  const activeUsage =
    insights.usageLevels.find((u) => u.level === selectedUsage) ??
    insights.usageLevels[0] ??
    null;
  const maxLetter =
    Math.max(...insights.overview.letterBars.map((b) => b.count), 1);

  return (
    <>
      <PageHeader
        title="Үндсэн мэдээлэл"
        description={
          meta?.structureNote ||
          "Платформын журам, толийн өгөгдлөөс автоматаар олдсон үзүүлэлтүүд."
        }
        actions={
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void load(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm disabled:opacity-60"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Дахин хайх
          </button>
        }
      />

      {error ? (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <p className="mb-5 text-xs text-[var(--muted)]">
        {insights.platformSearchNote} ·{" "}
        {new Date(insights.searchedAt).toLocaleString("mn-MN")}
      </p>

      <div className="space-y-5">
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-[var(--brand)]" />
            <h2 className="text-sm font-semibold">
              {meta?.title || "Толийн ерөнхий мэдээлэл"}
            </h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Нийт нэр томъёо"
              value={insights.overview.termCount}
            />
            <StatCard
              label="Тайлбартай"
              value={`${insights.overview.coveragePct}%`}
              hint={`${insights.overview.withDefinition} бүртгэл`}
            />
            <StatCard
              label="Товчлолтой"
              value={insights.overview.withAbbr}
            />
            <StatCard
              label="Монгол үсэг"
              value={insights.overview.letterCount}
            />
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[var(--brand)]" />
              <h3 className="text-sm font-semibold">Үсгээр ангилал</h3>
            </div>
            <BarList
              items={insights.overview.letterBars.map((row) => ({
                label: row.letter,
                value: row.count,
              }))}
              max={maxLetter}
            />
          </div>
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Split className="h-4 w-4 text-[var(--brand)]" />
            <h2 className="text-sm font-semibold">
              {meta?.homonymsTitle || "Ижил болон шилжсэн утга"}
            </h2>
          </div>
          <p className="mb-4 text-sm text-[var(--muted)]">
            {meta?.homonymsNote ||
              "Ижил монгол/англи нэршилтэй ч өөр тайлбартай нэр томъёог автоматаар илрүүллээ."}
          </p>
          {insights.homonyms.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Ижил/шилжсэн утга олдсонгүй.
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
              <div className="space-y-1">
                {insights.homonyms.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setSelectedHomonym(item.key)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm",
                      selectedHomonym === item.key
                        ? "bg-[var(--brand)] text-white"
                        : "hover:bg-[var(--bg)]",
                    )}
                  >
                    <span className="truncate">{item.label}</span>
                    <span className="ml-2 shrink-0 text-xs opacity-80">
                      {item.count}
                    </span>
                  </button>
                ))}
              </div>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)]/50 p-3">
                {activeHomonym ? (
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                      {activeHomonym.kind === "mn" ? "Монгол" : "Англи"} ·{" "}
                      {activeHomonym.label}
                    </p>
                    {activeHomonym.terms.map((term) => (
                      <div
                        key={term.id}
                        className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3"
                      >
                        <p className="text-sm font-medium">
                          {term.mn || "—"}{" "}
                          <span className="text-[var(--muted)]">/ {term.en || "—"}</span>
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {term.definition || "Тайлбар байхгүй"}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4 text-[var(--brand)]" />
            <h2 className="text-sm font-semibold">
              {meta?.sourceDocumentsTitle || "Нэршил орсон бичиг баримтууд"}
            </h2>
          </div>
          {insights.sourceDocuments.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Журмын сангаас нэршил олдсонгүй.
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
              <BarList
                items={insights.sourceDocuments.slice(0, 12).map((row) => ({
                  label: row.referenceCode || row.policyName.slice(0, 12),
                  value: row.hitCount,
                }))}
                max={Math.max(
                  ...insights.sourceDocuments.map((row) => row.hitCount),
                  1,
                )}
              />
              <div className="space-y-2">
                {insights.sourceDocuments.slice(0, 12).map((row) => (
                  <button
                    key={row.policyId}
                    type="button"
                    onClick={() => setSelectedSource(row.policyId)}
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-left text-sm",
                      selectedSource === row.policyId
                        ? "border-[var(--brand)] bg-[var(--brand)]/5"
                        : "border-[var(--border)] hover:bg-[var(--bg)]",
                    )}
                  >
                    <p className="font-medium">{row.policyName}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {row.referenceCode || "кодгүй"} · {row.hitCount} олдлоо
                    </p>
                  </button>
                ))}
              </div>
              {activeSource ? (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)]/50 p-3 lg:col-span-2">
                  <p className="text-sm font-medium">{activeSource.policyName}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    Олдсон нэршлүүд: {activeSource.sampleTerms.join(", ") || "—"}
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Layers className="h-4 w-4 text-[var(--brand)]" />
            <h2 className="text-sm font-semibold">
              {meta?.usageLevelsTitle || "Хэрэглээний түвшин"}
            </h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
            <UsageDonut buckets={insights.usageLevels} />
            <div className="space-y-2">
              {insights.usageLevels.map((bucket) => (
                <button
                  key={bucket.level}
                  type="button"
                  onClick={() => setSelectedUsage(bucket.level)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm",
                    selectedUsage === bucket.level
                      ? "border-[var(--brand)] bg-[var(--brand)]/5"
                      : "border-[var(--border)] hover:bg-[var(--bg)]",
                  )}
                >
                  <span>{bucket.label}</span>
                  <span className="text-[var(--muted)]">{bucket.count}</span>
                </button>
              ))}
              {activeUsage ? (
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)]/50 p-3">
                  <p className="mb-2 text-xs uppercase tracking-wide text-[var(--muted)]">
                    {activeUsage.label} · жишээ
                  </p>
                  <div className="space-y-1.5">
                    {activeUsage.terms.length === 0 ? (
                      <p className="text-sm text-[var(--muted)]">Хоосон</p>
                    ) : (
                      activeUsage.terms.map((term) => (
                        <div
                          key={term.id}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span>
                            {term.mn || term.en || "—"}
                            {term.en && term.mn ? (
                              <span className="text-[var(--muted)]">
                                {" "}
                                / {term.en}
                              </span>
                            ) : null}
                          </span>
                          <span className="text-xs text-[var(--muted)]">
                            {term.hits}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
