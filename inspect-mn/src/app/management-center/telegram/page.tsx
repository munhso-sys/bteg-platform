"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { ManagementNav } from "@/components/management/ManagementNav";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/cn";
import {
  CAPABILITY_HINTS,
  CAPABILITY_LABELS,
  DEFAULT_TELEGRAM_BOT_CONFIG,
  TELEGRAM_CAPABILITIES,
  type TelegramBotConfig,
  type TelegramCapability,
  type TelegramElevatedUser,
} from "@/lib/telegram/bot-config";

type KnownUser = {
  telegramId: string;
  username: string;
  fullName: string;
  lastSeenAt: string;
};

function emptyElevated(partial?: Partial<TelegramElevatedUser>): TelegramElevatedUser {
  return {
    telegramId: partial?.telegramId ?? "",
    username: partial?.username ?? "",
    fullName: partial?.fullName ?? "",
    capabilities: partial?.capabilities ?? ["ai.ask", "reports.overview"],
    note: partial?.note ?? "",
    updatedAt: partial?.updatedAt ?? new Date().toISOString(),
  };
}

export default function ManagementTelegramPage() {
  const [config, setConfig] = useState<TelegramBotConfig>(
    DEFAULT_TELEGRAM_BOT_CONFIG,
  );
  const [knownUsers, setKnownUsers] = useState<KnownUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [draftId, setDraftId] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/management-center/telegram/config", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Ачаалахад алдаа");
        return;
      }
      setConfig(data.config);
      setKnownUsers(data.knownUsers ?? []);
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

  const elevatedIds = useMemo(
    () => new Set(config.elevated.map((u) => u.telegramId)),
    [config.elevated],
  );

  const pickerUsers = useMemo(
    () => knownUsers.filter((u) => !elevatedIds.has(u.telegramId)),
    [knownUsers, elevatedIds],
  );

  function toggleDefault(cap: TelegramCapability) {
    setConfig((prev) => {
      const has = prev.defaults.includes(cap);
      const defaults = has
        ? prev.defaults.filter((c) => c !== cap)
        : [...prev.defaults, cap];
      return { ...prev, defaults };
    });
    setOkMsg("");
  }

  function toggleElevatedCap(telegramId: string, cap: TelegramCapability) {
    setConfig((prev) => ({
      ...prev,
      elevated: prev.elevated.map((u) => {
        if (u.telegramId !== telegramId) return u;
        const has = u.capabilities.includes(cap);
        return {
          ...u,
          capabilities: has
            ? u.capabilities.filter((c) => c !== cap)
            : [...u.capabilities, cap],
          updatedAt: new Date().toISOString(),
        };
      }),
    }));
    setOkMsg("");
  }

  function addElevated(user?: KnownUser) {
    const telegramId = (user?.telegramId || draftId).trim();
    if (!telegramId) {
      setError("Telegram ID оруулна уу");
      return;
    }
    if (elevatedIds.has(telegramId)) {
      setError("Энэ хэрэглэгч аль хэдийн жагсаалтад байна");
      return;
    }
    const known = user ?? knownUsers.find((u) => u.telegramId === telegramId);
    setConfig((prev) => ({
      ...prev,
      elevated: [
        emptyElevated({
          telegramId,
          username: known?.username ?? "",
          fullName: known?.fullName ?? "",
        }),
        ...prev.elevated,
      ],
    }));
    setDraftId("");
    setError("");
    setOkMsg("");
  }

  function removeElevated(telegramId: string) {
    setConfig((prev) => ({
      ...prev,
      elevated: prev.elevated.filter((u) => u.telegramId !== telegramId),
    }));
    setOkMsg("");
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setOkMsg("");
    try {
      const res = await fetch("/api/management-center/telegram/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Хадгалахад алдаа");
        return;
      }
      setConfig(data.config);
      setOkMsg("Тохиргоо хадгалагдлаа");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Telegram бот · эрх"
        description="Бүх хэрэглэгчийн үндсэн эрх болон сонгосон хэрэглэгчдэд AI / тайлан зэрэг нэмэлт эрх олгох."
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
      {okMsg ? (
        <p className="mb-3 text-sm text-emerald-700">{okMsg}</p>
      ) : null}

      <form onSubmit={onSave} className="space-y-4">
        <section className="rounded-md border border-[var(--border)] bg-[var(--card)]">
          <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold">
            Үндсэн эрх (бүх Telegram хэрэглэгч)
          </div>
          <div className="grid gap-2 p-3 sm:grid-cols-2">
            {TELEGRAM_CAPABILITIES.map((cap) => {
              const checked = config.defaults.includes(cap);
              return (
                <label
                  key={cap}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 text-sm",
                    checked
                      ? "border-[var(--brand)] bg-orange-50"
                      : "border-[var(--border)]",
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={checked}
                    onChange={() => toggleDefault(cap)}
                  />
                  <span>
                    <span className="font-medium">{CAPABILITY_LABELS[cap]}</span>
                    <span className="mt-0.5 block text-xs text-[var(--muted)]">
                      {CAPABILITY_HINTS[cap]}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <p className="border-t border-[var(--border)] px-3 py-2 text-xs text-[var(--muted)]">
            AI болон тайлан эрхийг ихэвчлэн зөвхөн elevated жагсаалтад өгнө. Үндсэн
            эрхэд зөвхөн дуу хоолойн үйлдлүүдийг үлдээнэ.
          </p>
        </section>

        <section className="rounded-md border border-[var(--border)] bg-[var(--card)]">
          <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold">
            Нэмэлт эрхтэй хэрэглэгчид
          </div>
          <div className="space-y-3 p-3">
            <div className="flex flex-wrap gap-2">
              <input
                className="input min-w-[12rem] flex-1"
                placeholder="Telegram ID"
                value={draftId}
                onChange={(e) => setDraftId(e.target.value)}
              />
              <button
                type="button"
                className="btn"
                onClick={() => addElevated()}
              >
                <Plus size={14} /> Нэмэх
              </button>
            </div>

            {pickerUsers.length > 0 ? (
              <div>
                <div className="mb-1 text-xs text-[var(--muted)]">
                  Ботоос мэдэгдсэн хэрэглэгчид
                </div>
                <div className="flex flex-wrap gap-2">
                  {pickerUsers.slice(0, 12).map((u) => (
                    <button
                      key={u.telegramId}
                      type="button"
                      className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-left text-xs hover:border-[var(--brand)]"
                      onClick={() => addElevated(u)}
                    >
                      <div className="font-medium">
                        {u.fullName || u.username || u.telegramId}
                      </div>
                      <div className="text-[var(--muted)]">
                        {u.username ? `@${u.username} · ` : ""}
                        {u.telegramId}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {config.elevated.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                Одоогоор нэмэлт эрхтэй хэрэглэгч алга.
              </p>
            ) : (
              <div className="space-y-3">
                {config.elevated.map((user) => (
                  <div
                    key={user.telegramId}
                    className="rounded-md border border-[var(--border)] p-3"
                  >
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold">
                          {user.fullName || user.username || user.telegramId}
                        </div>
                        <div className="text-xs text-[var(--muted)]">
                          ID: {user.telegramId}
                          {user.username ? ` · @${user.username}` : ""}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost px-2 py-1 text-xs text-rose-700"
                        onClick={() => removeElevated(user.telegramId)}
                      >
                        <Trash2 size={14} /> Устгах
                      </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {TELEGRAM_CAPABILITIES.map((cap) => {
                        const checked = user.capabilities.includes(cap);
                        return (
                          <label
                            key={cap}
                            className="flex items-start gap-2 text-sm"
                          >
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={checked}
                              onChange={() =>
                                toggleElevatedCap(user.telegramId, cap)
                              }
                            />
                            <span>
                              <span className="font-medium">
                                {CAPABILITY_LABELS[cap]}
                              </span>
                              <span className="mt-0.5 block text-[11px] text-[var(--muted)]">
                                {CAPABILITY_HINTS[cap]}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <input
                      className="input mt-2 w-full text-sm"
                      placeholder="Тэмдэглэл (албан тушаал, шалтгаан…)"
                      value={user.note}
                      onChange={(e) =>
                        setConfig((prev) => ({
                          ...prev,
                          elevated: prev.elevated.map((u) =>
                            u.telegramId === user.telegramId
                              ? { ...u, note: e.target.value }
                              : u,
                          ),
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Save size={14} />
            )}
            Хадгалах
          </button>
          <span className="text-xs text-[var(--muted)]">
            Сүүлд:{" "}
            {config.updatedAt && config.updatedAt !== new Date(0).toISOString()
              ? new Date(config.updatedAt).toLocaleString("mn-MN")
              : "—"}
          </span>
        </div>
      </form>
    </div>
  );
}
