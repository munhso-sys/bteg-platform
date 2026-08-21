"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Loader2,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  User,
  FileSearch,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/cn";
import type { AiChatModule } from "@/lib/ai/types";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  source?: string;
  at: string;
};

type StatusPayload = {
  openaiConfigured?: boolean;
  generatedAt?: string;
  scopeMode?: "all" | "unit" | "none";
  scopeNote?: string;
  kpis?: Array<{ label: string; value: string; hint: string }>;
  highlights?: string[];
  sourceErrors?: Record<string, string>;
  error?: string;
};

const MODULES: Array<{ id: AiChatModule; label: string }> = [
  { id: "general", label: "Ерөнхий" },
  { id: "inspection", label: "Хяналт шалгалт" },
  { id: "policy", label: "Журмын биелэлт" },
  { id: "development", label: "Судалгаа хөгжүүлэлт" },
  { id: "voice", label: "Ажилтны дуу хоолой" },
  { id: "risk", label: "Эрсдэл" },
  { id: "smartmine", label: "SmartMine" },
  { id: "reports", label: "Тайлан" },
];

const PROMPTS: Array<{ module: AiChatModule; text: string }> = [
  {
    module: "general",
    text: "Өнөөдрийн удирдлагын товч дүгнэлт гарга. Гол эрсдэл, нээлттэй ажлыг дурд.",
  },
  {
    module: "inspection",
    text: "Хяналт шалгалтын өндөр эрсдэлтэй зөрчил, хугацаа хэтэрсэн ажлыг товчил.",
  },
  {
    module: "policy",
    text: "Нийт бүртгэгдсэн журмын тоо хэд вэ? Гол сул цэг, сайжруулах 3 зөвлөмж өг.",
  },
  {
    module: "voice",
    text: "Ажилтны дуу хоолойн нээлттэй санал/гомдол, давтамжтай сэдвийг тайлбарла.",
  },
  {
    module: "risk",
    text: "Идэвхтэй эрсдэлийн тоо, өндөр зэрэглэл, нэгжийн үлдэгдэл эрсдэлийг харьцуул.",
  },
  {
    module: "development",
    text: "Судалгаа хөгжүүлэлтийн хоцролттой ажил, дараагийн алхмуудыг санал болго.",
  },
  {
    module: "smartmine",
    text: "SmartMine боловсруулалт, downtime, MTTR болон техникийн ажиллагааны гол KPI-г дүгнэ.",
  },
];

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function AiAssistantClient() {
  const [module, setModule] = useState<AiChatModule>("general");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Сайн байна уу. Би INSPECT-MN AI туслах. Хяналт шалгалт, журам, СХ, ажилтны дуу хоолой, эрсдэл, тайлангийн талаар асуугаарай.",
      at: nowIso(),
      source: "system",
    },
  ]);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  const prompts = useMemo(
    () =>
      PROMPTS.filter((p) => p.module === module || p.module === "general").slice(
        0,
        4,
      ),
    [module],
  );

  async function loadStatus() {
    setLoadingStatus(true);
    setError("");
    try {
      const res = await fetch("/api/ai/chat", { cache: "no-store" });
      const data = (await res.json()) as StatusPayload & { ok?: boolean };
      if (!res.ok || data.ok === false) {
        setError(data.error || "Контекст ачаалахад алдаа");
        return;
      }
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа");
    } finally {
      setLoadingStatus(false);
    }
  }

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadStatus();
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  async function ask(question: string) {
    const message = question.trim();
    if (message.length < 2 || sending) return;

    const userMsg: ChatMessage = {
      id: newId(),
      role: "user",
      content: message,
      at: nowIso(),
    };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setSending(true);
    setError("");

    try {
      const history = nextMessages
        .filter((m) => m.id !== "welcome")
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, module, history }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "AI хариу авахад алдаа");
        setMessages((prev) => [
          ...prev,
          {
            id: newId(),
            role: "assistant",
            content: data.error || "AI хариу авахад алдаа гарлаа.",
            at: nowIso(),
            source: "error",
          },
        ]);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: data.answer || "Хоосон хариу",
          at: nowIso(),
          source: data.source,
        },
      ]);
      if (data.kpis || data.highlights || data.scopeNote) {
        setStatus((prev) => ({
          ...(prev ?? {}),
          generatedAt: data.generatedAt ?? prev?.generatedAt,
          scopeMode: data.scopeMode ?? prev?.scopeMode,
          scopeNote: data.scopeNote ?? prev?.scopeNote,
          kpis: data.kpis ?? prev?.kpis,
          highlights: data.highlights ?? prev?.highlights,
          sourceErrors: data.sourceErrors ?? prev?.sourceErrors,
          openaiConfigured:
            data.source === "openai"
              ? true
              : data.source === "local"
                ? false
                : prev?.openaiConfigured,
        }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Алдаа";
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          id: newId(),
          role: "assistant",
          content: msg,
          at: nowIso(),
          source: "error",
        },
      ]);
    } finally {
      setSending(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  return (
    <div>
      <PageHeader
        title="AI туслах"
        description="Платформын модулиудын нэгтгэсэн өгөгдөл дээр суурилсан асуулт хариулт, товчлол, зөвлөмж."
        actions={
          <>
            <Link href="/policy-review" className="btn btn-primary">
              <FileSearch size={14} /> Баримт харьцуулах
            </Link>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void loadStatus()}
              disabled={loadingStatus}
            >
              <RefreshCw
                size={14}
                className={loadingStatus ? "animate-spin" : ""}
              />
              Контекст шинэчлэх
            </button>
          </>
        }
      />

      {error ? (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {status?.scopeNote ? (
        <div className="mb-3 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--muted)]">
          Мэдээллийн хүрээ:{" "}
          <span className="font-medium text-[var(--fg)]">{status.scopeNote}</span>
          {status.scopeMode ? (
            <span className="ml-2 text-xs uppercase tracking-wide">
              ({status.scopeMode})
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {MODULES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn("btn", module === item.id && "btn-primary")}
            onClick={() => setModule(item.id)}
          >
            {item.label}
          </button>
        ))}
        <span
          className={cn(
            "ml-auto rounded-md border px-2.5 py-1 text-xs font-medium",
            status?.openaiConfigured
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-800",
          )}
        >
          {loadingStatus
            ? "Шалгаж байна…"
            : status?.openaiConfigured
              ? "OpenAI холбогдсон"
              : "Local горим · KPI товчлол"}
        </span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex h-[min(72vh,760px)] min-h-[560px] flex-col overflow-hidden rounded-md border border-[var(--border)] bg-white">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles size={16} className="text-[var(--brand)]" />
              Чат
            </div>
            <button
              type="button"
              className="btn btn-ghost px-2 py-1 text-xs"
              onClick={() =>
                setMessages([
                  {
                    id: "welcome",
                    role: "assistant",
                    content:
                      "Яриа цэвэрлэгдлээ. Шинэ асуултаа бичнэ үү.",
                    at: nowIso(),
                    source: "system",
                  },
                ])
              }
            >
              <Trash2 size={14} /> Цэвэрлэх
            </button>
          </div>

          <div className="ai-chat-scroll min-h-0 flex-1 space-y-3 overflow-y-scroll p-3">
            {messages.map((msg) => {
              const mine = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={cn("flex gap-2", mine ? "justify-end" : "justify-start")}
                >
                  {!mine ? (
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--brand)] text-white">
                      <Bot size={16} />
                    </div>
                  ) : null}
                  <div
                    className={cn(
                      "max-w-[min(100%,42rem)] rounded-md border px-3 py-2 text-sm leading-6",
                      mine
                        ? "border-[var(--brand)] bg-orange-50 text-[var(--fg)]"
                        : "border-[var(--border)] bg-slate-50 text-[var(--fg)]",
                    )}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    <div className="mt-1 text-[10px] text-[var(--muted)]">
                      {new Date(msg.at).toLocaleTimeString("mn-MN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {msg.source ? ` · ${msg.source}` : ""}
                    </div>
                  </div>
                  {mine ? (
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-800 text-white">
                      <User size={16} />
                    </div>
                  ) : null}
                </div>
              );
            })}
            {sending ? (
              <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <Loader2 size={16} className="animate-spin" />
                Шинжилж байна…
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          <div className="shrink-0 border-t border-[var(--border)] p-3">
            <div className="mb-2 flex flex-wrap gap-2">
              {prompts.map((p) => (
                <button
                  key={p.text}
                  type="button"
                  className="rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-left text-xs text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--fg)]"
                  onClick={() => void ask(p.text)}
                  disabled={sending}
                >
                  {p.text}
                </button>
              ))}
            </div>
            <form onSubmit={onSubmit} className="flex gap-2">
              <textarea
                className="textarea min-h-[3rem] flex-1"
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="AI-аас асуух…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void ask(input);
                  }
                }}
              />
              <button
                type="submit"
                className="btn btn-primary self-end"
                disabled={sending || input.trim().length < 2}
              >
                {sending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                Илгээх
              </button>
            </form>
          </div>
        </section>

        <aside className="space-y-3">
          <section className="rounded-md border border-[var(--border)] bg-white">
            <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold">
              Контекстийн KPI
            </div>
            <div className="space-y-2 p-3">
              {(status?.kpis ?? []).length === 0 ? (
                <p className="text-sm text-[var(--muted)]">
                  {loadingStatus ? "Ачаалж байна…" : "KPI алга"}
                </p>
              ) : (
                status?.kpis?.map((k) => (
                  <div
                    key={`${k.label}-${k.value}`}
                    className="rounded border border-[var(--border)] px-2.5 py-2"
                  >
                    <div className="text-[11px] uppercase tracking-wide text-[var(--muted)]">
                      {k.label}
                    </div>
                    <div className="text-lg font-semibold tabular-nums">
                      {k.value}
                    </div>
                    <div className="text-xs text-[var(--muted)]">{k.hint}</div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-md border border-[var(--border)] bg-white">
            <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold">
              Онцлох
            </div>
            <ul className="space-y-2 p-3 text-sm text-[var(--fg)]">
              {(status?.highlights ?? []).length === 0 ? (
                <li className="text-[var(--muted)]">Мэдээлэл алга</li>
              ) : (
                status?.highlights?.map((h) => (
                  <li
                    key={h}
                    className="rounded border border-[var(--border)] bg-slate-50 px-2.5 py-2 text-xs leading-5"
                  >
                    {h}
                  </li>
                ))
              )}
            </ul>
          </section>

          {status?.sourceErrors &&
          Object.keys(status.sourceErrors).length > 0 ? (
            <section className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <div className="mb-1 font-semibold">Эх системийн анхааруулга</div>
              {Object.entries(status.sourceErrors).map(([key, err]) => (
                <div key={key}>
                  {key}: {err}
                </div>
              ))}
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
