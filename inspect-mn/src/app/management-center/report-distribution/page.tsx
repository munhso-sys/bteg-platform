"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, RefreshCw, Save, Send, SendHorizontal } from "lucide-react";
import { ManagementNav } from "@/components/management/ManagementNav";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  DEFAULT_REPORT_DISTRIBUTION_CONFIG,
  type ReportChannelSchedule,
  type ReportDistributionConfig,
  type ReportFrequency,
} from "@/lib/reports/distribution-config";

const FREQUENCY_LABELS: Record<ReportFrequency, string> = {
  daily: "Өдөр бүр",
  weekly: "7 хоног бүр",
  monthly: "Сар бүр",
};

export default function ReportDistributionSettingsPage() {
  const [config, setConfig] = useState<ReportDistributionConfig>(DEFAULT_REPORT_DISTRIBUTION_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<"email" | "telegram" | "">("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/management-center/report-distribution", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Ачаалахад алдаа");
      setConfig(data.config);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ачаалахад алдаа");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, []);

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/management-center/report-distribution", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Хадгалахад алдаа");
      setConfig(data.config);
      setMessage("Тайлан түгээлтийн тохиргоо хадгалагдлаа.");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хадгалахад алдаа");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function test(channel: "email" | "telegram") {
    setTesting(channel);
    setError("");
    setMessage("");
    try {
      if (!(await save())) return;
      const res = await fetch("/api/management-center/report-distribution/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Илгээхэд алдаа");
      setConfig(data.config);
      setMessage(channel === "email" ? `Email: ${data.email}` : `Telegram: ${data.telegram}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Илгээхэд алдаа");
    } finally {
      setTesting("");
    }
  }

  function updateChannel(key: "detailedEmail" | "telegramSummary", patch: Partial<ReportChannelSchedule>) {
    setConfig((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
    setMessage("");
  }

  return (
    <div>
      <PageHeader
        title="Тайлан түгээлт"
        description="Дэлгэрэнгүй албан тайланг email + PDF-ээр, хураангуй KPI тайланг Telegram ботоор тогтмол түгээх."
        actions={
          <div className="flex gap-2">
            <button className="btn btn-ghost" type="button" onClick={() => void load()} disabled={loading || saving}>
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Шинэчлэх
            </button>
            <button className="btn btn-primary" type="button" onClick={() => void save()} disabled={loading || saving}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Хадгалах
            </button>
          </div>
        }
      />
      <ManagementNav />

      {error ? <p className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p> : null}
      {message ? <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}

      <section className="mb-4 rounded-md border border-[var(--border)] bg-[var(--card)] p-3">
        <label className="block max-w-sm text-sm font-medium">
          Тайлангийн цагийн бүс
          <input className="input mt-1 w-full" value={config.timezone} onChange={(event) => setConfig((prev) => ({ ...prev, timezone: event.target.value }))} />
        </label>
        <p className="mt-2 text-xs text-[var(--muted)]">Vercel Hobby scheduler өдөр бүр Улаанбаатарын 09:00 цагт шалгаж, сонгосон өдөр болон period key таарахад нэг удаа илгээнэ.</p>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChannelCard
          icon={<Mail size={17} />}
          title="Дэлгэрэнгүй тайлан · Email"
          description="Удирдлагын хураангуй, KPI, арга зүй, суурь шалтгааны indicator, олдвор, арга хэмжээ болон PDF хавсралт."
          schedule={config.detailedEmail}
          recipientLabel="Хүлээн авагчийн email"
          recipientPlaceholder="director@company.mn, audit@company.mn"
          status={config.lastEmailStatus}
          onChange={(patch) => updateChannel("detailedEmail", patch)}
          onTest={() => void test("email")}
          testing={testing === "email"}
        />
        <ChannelCard
          icon={<SendHorizontal size={17} />}
          title="Хураангуй тайлан · Telegram"
          description="Гол KPI, өндөр эрсдэл, суурь шалтгааны indicator, шуурхай арга хэмжээ болон дэлгэрэнгүй тайлангийн холбоос."
          schedule={config.telegramSummary}
          recipientLabel="Telegram chat ID"
          recipientPlaceholder="123456789, -1001234567890"
          status={config.lastTelegramStatus}
          onChange={(patch) => updateChannel("telegramSummary", patch)}
          onTest={() => void test("telegram")}
          testing={testing === "telegram"}
        />
      </div>

      <section className="mt-4 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs text-[var(--muted)]">
        <div className="font-semibold text-[var(--fg)]">Шаардлагатай server-side тохиргоо</div>
        <div className="mt-1">Email: RESEND_API_KEY, EMAIL_FROM · Telegram: TELEGRAM_BOT_TOKEN · Scheduler: CRON_SECRET.</div>
        <div className="mt-1">Сүүлд шинэчилсэн: {config.updatedAt ? new Date(config.updatedAt).toLocaleString("mn-MN") : "—"}</div>
      </section>
    </div>
  );
}

function ChannelCard({
  icon,
  title,
  description,
  schedule,
  recipientLabel,
  recipientPlaceholder,
  status,
  onChange,
  onTest,
  testing,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  schedule: ReportChannelSchedule;
  recipientLabel: string;
  recipientPlaceholder: string;
  status: string;
  onChange: (patch: Partial<ReportChannelSchedule>) => void;
  onTest: () => void;
  testing: boolean;
}) {
  return (
    <section className="rounded-md border border-[var(--border)] bg-[var(--card)]">
      <div className="border-b border-[var(--border)] p-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--fg)]">{icon}{title}</div>
        <p className="mt-1 text-xs text-[var(--muted)]">{description}</p>
      </div>
      <div className="space-y-3 p-3">
        <label className="flex items-center justify-between gap-3 rounded border border-[var(--border)] px-3 py-2 text-sm">
          <span><span className="font-medium">Автомат илгээлт</span><span className="block text-xs text-[var(--muted)]">Хуваарийн дагуу нэг удаа</span></span>
          <input type="checkbox" checked={schedule.enabled} onChange={(event) => onChange({ enabled: event.target.checked })} />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs font-medium">Давтамж<select className="input mt-1 w-full" value={schedule.frequency} onChange={(event) => onChange({ frequency: event.target.value as ReportFrequency })}>{Object.entries(FREQUENCY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="text-xs font-medium">Илгээх цаг<input className="input mt-1 w-full" value="09:00 · Улаанбаатар" readOnly aria-label="Илгээх тогтсон цаг" /></label>
          {schedule.frequency === "weekly" ? <label className="text-xs font-medium">7 хоногийн өдөр<select className="input mt-1 w-full" value={schedule.dayOfWeek} onChange={(event) => onChange({ dayOfWeek: Number(event.target.value) })}>{["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"].map((label, index) => <option key={label} value={index}>{label}</option>)}</select></label> : null}
          {schedule.frequency === "monthly" ? <label className="text-xs font-medium">Сарын өдөр<input className="input mt-1 w-full" type="number" min={1} max={28} value={schedule.dayOfMonth} onChange={(event) => onChange({ dayOfMonth: Number(event.target.value) })} /></label> : null}
        </div>
        <label className="block text-xs font-medium">{recipientLabel}<textarea className="input mt-1 min-h-24 w-full resize-y" placeholder={recipientPlaceholder} value={schedule.recipients.join("\n")} onChange={(event) => onChange({ recipients: event.target.value.split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean) })} /></label>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
          <span className="text-xs text-[var(--muted)]">Сүүлчийн төлөв: {status || "—"}</span>
          <button type="button" className="btn" onClick={onTest} disabled={testing || schedule.recipients.length === 0}>{testing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Туршилтаар илгээх</button>
        </div>
      </div>
    </section>
  );
}
