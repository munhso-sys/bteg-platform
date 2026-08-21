"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { VoiceNav } from "@/components/voice/VoiceNav";
import { cn } from "@/lib/cn";
import { VOICE_TYPE_LABELS } from "@/lib/voice/types";

type Overview = {
  kpis: {
    total: number;
    open: number;
    high: number;
    telegram: number;
    actionsOpen: number;
    overdue: number;
    notices: number;
  };
  byType: { type: string; label: string; count: number; open: number }[];
  themes: { label: string; count: number }[];
  conclusions: string[];
  recent: { id: string; title: string; type: keyof typeof VOICE_TYPE_LABELS; source: string; createdAt: string }[];
};

export default function EmployeeVoicePage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/employee-voice/overview", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "Ачаалахад алдаа");
        return;
      }
      setData(json);
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

  return (
    <div>
      <PageHeader
        title="Ажилтны дуу хоолой"
        description="Санал, хүсэлт, гомдол, асуулгыг Telegram болон вэбээр бүртгэж, боловсруулах, хариу арга хэмжээг төлөвлөх, эрсдэл/СХ-д мэдэгдэнэ."
        actions={
          <button type="button" className="btn btn-ghost" onClick={() => void load()}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Шинэчлэх
          </button>
        }
      />
      <VoiceNav />
      {error ? (
        <p className="mb-3 text-sm text-rose-700">{error}</p>
      ) : null}

      <section className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Нийт" value={data?.kpis.total ?? "—"} tone="neutral" />
        <Kpi label="Нээлттэй" value={data?.kpis.open ?? "—"} tone="warn" />
        <Kpi label="Өндөр" value={data?.kpis.high ?? "—"} tone="bad" />
        <Kpi label="Telegram" value={data?.kpis.telegram ?? "—"} tone="neutral" />
        <Kpi label="Хийгдэж буй ажил" value={data?.kpis.actionsOpen ?? "—"} tone="good" />
        <Kpi label="Хэтэрсэн" value={data?.kpis.overdue ?? "—"} tone="bad" />
      </section>

      <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <ToolCard href="/employee-voice/inbox" title="Бүртгэл" text="Санал, хүсэлт, гомдол, асуулга бүртгэх" />
        <ToolCard href="/employee-voice/process" title="Боловсруулалт" text="Шинжлэх, дүгнэх, чиг хандлага" />
        <ToolCard href="/employee-voice/actions" title="Хариу арга хэмжээ" text="Таамаглах, төлөвлөх, гүйцэтгэл хянах" />
        <ToolCard href="/employee-voice/telegram" title="Telegram бот" text="Бот холбоос, webhook, команд" />
        <ToolCard href="/employee-voice/notify" title="Мэдэгдэл" text="Эрсдэл болон СХ хуудсанд мэдэгдэх" />
        <ToolCard href="/risk-management" title="Эрсдэлийн хуудас" text="Дуу хоолойноос үүссэн эрсдэлийг харах" />
      </section>

      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <section className="rounded-md border border-[var(--border)] bg-[var(--card)]">
          <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold">
            Төрлөөр
          </div>
          <div className="grid grid-cols-2 gap-2 p-3">
            {(data?.byType ?? []).map((row) => (
              <div key={row.type} className="rounded border border-[var(--border)] px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-[var(--muted)]">
                  {row.label}
                </div>
                <div className="text-xl font-semibold tabular-nums">{row.count}</div>
                <div className="text-xs text-[var(--muted)]">Нээлттэй {row.open}</div>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-md border border-[var(--border)] bg-[var(--card)]">
          <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold">
            Дүгнэлт
          </div>
          <ul className="space-y-1 p-3 text-sm">
            {(data?.conclusions ?? []).map((line) => (
              <li
                key={line}
                className="rounded border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2"
              >
                {line}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-md border border-[var(--border)] bg-[var(--card)]">
        <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold">
          Сүүлийн бүртгэл
        </div>
        <table>
          <thead>
            <tr>
              <th>Гарчиг</th>
              <th>Төрөл</th>
              <th>Эх</th>
              <th>Огноо</th>
            </tr>
          </thead>
          <tbody>
            {(data?.recent ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} className="text-sm text-[var(--muted)]">
                  Бүртгэл алга.
                </td>
              </tr>
            ) : (
              data!.recent.map((row) => (
                <tr key={row.id}>
                  <td className="font-medium">{row.title}</td>
                  <td>{VOICE_TYPE_LABELS[row.type]}</td>
                  <td>{row.source === "telegram" ? "Telegram" : "Вэб"}</td>
                  <td className="tabular-nums text-xs">
                    {row.createdAt.slice(0, 10)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
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
