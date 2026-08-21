"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { VoiceNav } from "@/components/voice/VoiceNav";

type Status = {
  configured: boolean;
  webhookUrl: string;
  bot: { username?: string; first_name?: string } | null;
  webhook: { url?: string; pending_update_count?: number; last_error_message?: string } | null;
  error?: string | null;
};

export default function VoiceTelegramPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/employee-voice/telegram/status", {
      cache: "no-store",
    });
    const data = await res.json();
    if (data.ok) setStatus(data);
    else setMessage(data.error || "Статус уншигдсангүй");
  }

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  async function setWebhook() {
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/employee-voice/telegram/set-webhook", {
      method: "POST",
    });
    const data = await res.json();
    setBusy(false);
    setMessage(
      data.ok
        ? "Webhook амжилттай холбогдлоо"
        : data.error || data.telegramResponse?.description || "Амжилтгүй",
    );
    await load();
  }

  return (
    <div>
      <PageHeader
        title="Telegram бот"
        description="Ажилтан ботоор санал, хүсэлт, гомдол, асуулга илгээнэ."
        actions={
          <button type="button" className="btn btn-ghost" onClick={() => void load()}>
            <RefreshCw size={14} />
          </button>
        }
      />
      <VoiceNav />

      <section className="mb-4 rounded-md border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
        <div className="font-semibold">Холболт</div>
        {status?.configured ? (
          <p className="mt-2 text-[var(--muted)]">
            Бот: @{status.bot?.username || "—"} · webhook:{" "}
            {status.webhook?.url || "тохируулаагүй"}
          </p>
        ) : (
          <p className="mt-2 text-[var(--muted)]">
            Vercel дээр <code>TELEGRAM_BOT_TOKEN</code> нэмж, доорх товчоор webhook
            заана. BotFather-аас токен авна.
          </p>
        )}
        <p className="mt-2 font-mono text-xs text-[var(--muted)]">
          {status?.webhookUrl}
        </p>
        {status?.webhook?.last_error_message ? (
          <p className="mt-2 text-rose-700">{status.webhook.last_error_message}</p>
        ) : null}
        <button
          type="button"
          className="btn btn-primary mt-3"
          disabled={busy || !status?.configured}
          onClick={() => void setWebhook()}
        >
          Webhook холбох
        </button>
        {message ? <p className="mt-2">{message}</p> : null}
      </section>

      <section className="rounded-md border border-[var(--border)] bg-[var(--card)] p-4 text-sm">
        <div className="font-semibold">Команд</div>
        <ul className="mt-2 space-y-1 text-[var(--muted)]">
          <li>/санал [текст]</li>
          <li>/хүсэлт [текст]</li>
          <li>/гомдол [текст]</li>
          <li>/асуулга [текст]</li>
          <li>/voice гомдол [текст]</li>
          <li>/anonymous [текст] — нэргүй</li>
          <li>/ai [асуулт] — нэмэлт эрх шаардана</li>
          <li>/тайлан — нэмэлт эрх шаардана</li>
        </ul>
        <p className="mt-3 text-xs text-[var(--muted)]">
          AI / тайлан эрхийг{" "}
          <a
            href="/management-center/telegram"
            className="text-[var(--brand)] hover:underline"
          >
            Удирдлагын төв → Telegram бот
          </a>{" "}
          хуудаснаас тохируулна.
        </p>
      </section>
    </div>
  );
}
