"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  LayoutDashboard,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { ManagementNav } from "@/components/management/ManagementNav";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/cn";
import type { ManagementOverview } from "@/lib/management-center/overview";

export function ManagementCenterClient() {
  const [data, setData] = useState<ManagementOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/management-center/overview", {
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "Ачаалахад алдаа");
        return;
      }
      setData(json as ManagementOverview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const people = data?.people;
  const pendingCount = data?.access.pendingCount ?? 0;
  const onlineModules = data?.modules.filter((m) => m.online).length ?? 0;
  const moduleTotal = data?.modules.length ?? 0;

  return (
    <div>
      <PageHeader
        title="Удирдлагын төв"
        description="Хэрэглэгч, эрх, модуль хандалт, системийн бэлэн байдлын нэгдсэн самбар."
        actions={
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Шинэчлэх
          </button>
        }
      />
      <ManagementNav />

      {error ? (
        <p className="mb-3 text-sm text-rose-700">{error}</p>
      ) : null}

      <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Хэрэглэгч" value={people?.total ?? "—"} tone="neutral" />
        <Kpi label="Идэвхтэй" value={people?.active ?? "—"} tone="good" />
        <Kpi label="Админ" value={people?.admins ?? "—"} tone="neutral" />
        <Kpi
          label="Нэвтрэх хүсэлт"
          value={pendingCount}
          tone={pendingCount > 0 ? "warn" : "good"}
        />
        <Kpi
          label="Хугацаатай эрх"
          value={data?.grants.activeCount ?? "—"}
          tone="neutral"
        />
        <Kpi
          label="Модуль онлайн"
          value={data ? `${onlineModules}/${moduleTotal}` : "—"}
          tone={
            data && onlineModules === moduleTotal
              ? "good"
              : data
                ? "warn"
                : "neutral"
          }
        />
      </section>

      <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <ToolCard
          href="/management-center/telegram"
          title="Telegram бот · эрх"
          text="Үндсэн / нэмэлт эрх: дуу хоолой, AI, тайлан"
        />
        <ToolCard
          href="/management-center/ai-scope"
          title="AI мэдээллийн эрх"
          text="Role + алба/хэлтэсээр AI-ийн өгөгдлийн хүрээ"
        />
        <ToolCard
          href="/management-center/report-distribution"
          title="Тайлан түгээлт"
          text="Дэлгэрэнгүй email · хураангуй Telegram · хуваарь"
        />
        <ToolCard
          href="/settings/users"
          title="Хэрэглэгч / Role"
          text="Профайл, статус, role оноох"
        />
        <ToolCard
          href="/settings/access-requests"
          title="Нэвтрэх хүсэлт"
          text={`${pendingCount} хүлээгдэж буй хүсэлт`}
        />
        <ToolCard
          href="/settings/roles"
          title="Role эрх"
          text="Модуль болон үйлдлийн эрх тохируулах"
        />
        <ToolCard
          href="/settings/temp-grants"
          title="Хугацаатай эрх"
          text="Засах эрхийг хугацаагаар олгох"
        />
        <ToolCard
          href="/settings/session"
          title="Сесс / Auto logout"
          text={
            data?.session.idleLogoutMinutes
              ? `${data.session.idleLogoutMinutes} мин идэвхгүй → гарах`
              : "Auto logout унтраасан"
          }
        />
        <ToolCard
          href="/ai-assistant"
          title="AI туслах"
          text="Удирдлагын товчлол, зөвлөмж"
        />
        <ToolCard
          href="/risk-management"
          title="Эрсдэлийн удирдлага"
          text="Эрсдэлийн самбар, бүртгэл"
        />
        <ToolCard
          href="/report-analysis"
          title="Тайлан шинжилгээ"
          text="Платформын нэгтгэсэн тайлан"
        />
        <ToolCard
          href="/smartmine"
          title="SmartMine"
          text="Processing, equipment, MTTR / downtime"
        />
      </section>

      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <section className="rounded-md border border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
            <h2 className="text-sm font-semibold">Модуль хандалт</h2>
            <LayoutDashboard size={14} className="text-[var(--muted)]" />
          </div>
          <div className="divide-y divide-[var(--border)]">
            {(data?.modules ?? []).length === 0 ? (
              <p className="p-3 text-sm text-[var(--muted)]">
                {loading ? "Шалгаж байна…" : "Мэдээлэл алга"}
              </p>
            ) : (
              data!.modules.map((m) => (
                <div
                  key={m.id}
                  className="flex items-start justify-between gap-3 px-3 py-3 text-sm"
                >
                  <div>
                    <Link
                      href={m.href}
                      className="font-semibold hover:text-[var(--brand)]"
                    >
                      {m.label}
                    </Link>
                    <div className="mt-0.5 font-mono text-[11px] text-[var(--muted)]">
                      {m.origin}
                    </div>
                  </div>
                  <StatusPill ok={m.online} />
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-md border border-[var(--border)] bg-[var(--card)]">
          <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold">
            Системийн төлөв
          </div>
          <div className="space-y-3 p-3 text-sm">
            <div className="flex items-start gap-3">
              {data?.supabase.ok ? (
                <CheckCircle2 className="mt-0.5 text-emerald-600" size={18} />
              ) : (
                <XCircle className="mt-0.5 text-rose-600" size={18} />
              )}
              <div>
                <div className="font-semibold">
                  Supabase{" "}
                  {loading
                    ? "…"
                    : data?.supabase.ok
                      ? "холбогдсон"
                      : "холбогдоогүй"}
                </div>
                <div className="mt-1 text-[var(--muted)]">
                  {data?.supabase.projectName ?? "—"}
                  {data?.supabase.projectRef
                    ? ` · ${data.supabase.projectRef}`
                    : ""}
                </div>
                {data?.supabase.error ? (
                  <div className="mt-1 text-xs text-rose-700">
                    {data.supabase.error}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="rounded border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2 text-xs text-[var(--muted)]">
              Сүүлд шинэчилсэн:{" "}
              {data?.generatedAt
                ? new Date(data.generatedAt).toLocaleString("mn-MN")
                : "—"}
            </div>
          </div>
        </section>
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <section className="rounded-md border border-[var(--border)] bg-[var(--card)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
            <h2 className="text-sm font-semibold">Хүлээгдэж буй нэвтрэх хүсэлт</h2>
            <Link
              href="/settings/access-requests"
              className="text-xs text-[var(--brand)] hover:underline"
            >
              Бүгдийг харах
            </Link>
          </div>
          <table>
            <thead>
              <tr>
                <th>Нэр</th>
                <th>Имэйл</th>
                <th>Нэгж</th>
                <th>Огноо</th>
              </tr>
            </thead>
            <tbody>
              {(data?.access.recentPending ?? []).length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-sm text-[var(--muted)]">
                    {loading ? "Ачаалж байна…" : "Хүлээгдэж буй хүсэлт алга."}
                  </td>
                </tr>
              ) : (
                data!.access.recentPending.map((row) => (
                  <tr key={row.id}>
                    <td className="font-medium">
                      {row.full_name || "—"}
                    </td>
                    <td className="text-xs">{row.email}</td>
                    <td className="text-xs">
                      {[row.heltes_name, row.alba_name]
                        .filter(Boolean)
                        .join(" / ") || "—"}
                    </td>
                    <td className="tabular-nums text-xs">
                      {row.created_at.slice(0, 10)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        <section className="rounded-md border border-[var(--border)] bg-[var(--card)]">
          <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold">
            Дүгнэлт
          </div>
          <ul className="space-y-1 p-3 text-sm">
            {(data?.conclusions ?? []).length === 0 ? (
              <li className="text-[var(--muted)]">
                {loading ? "Ачаалж байна…" : "Мэдээлэл алга"}
              </li>
            ) : (
              data!.conclusions.map((line) => (
                <li
                  key={line}
                  className="rounded border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2"
                >
                  {line}
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "neutral" | "good" | "warn" | "bad";
}) {
  const bar = {
    neutral: "border-l-slate-400",
    good: "border-l-emerald-500",
    warn: "border-l-amber-500",
    bad: "border-l-rose-500",
  } as const;
  return (
    <div
      className={cn(
        "rounded-md border border-[var(--border)] border-l-4 bg-[var(--card)] p-3",
        bar[tone],
      )}
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function ToolCard({
  href,
  title,
  text,
}: {
  href: string;
  title: string;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-3 text-sm hover:border-[var(--brand)]"
    >
      <div className="font-semibold">{title}</div>
      <div className="mt-1 text-[var(--muted)]">{text}</div>
    </Link>
  );
}

function StatusPill({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium",
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700",
      )}
    >
      {ok ? "Онлайн" : "Офлайн"}
    </span>
  );
}
