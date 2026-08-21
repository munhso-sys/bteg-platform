"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Save, Timer } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { SettingsAdminRedirect } from "@/components/settings/SettingsAdminRedirect";
import {
  DEFAULT_SESSION_SETTINGS,
  IDLE_LOGOUT_PRESETS,
  clampIdleLogoutMinutes,
  writeCachedSessionSettings,
  type SessionSettings,
} from "@/lib/session-settings";

export default function SessionSettingsPage() {
  const [minutes, setMinutes] = useState(
    DEFAULT_SESSION_SETTINGS.idleLogoutMinutes,
  );
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setSavedMsg("");
    try {
      const res = await fetch("/api/settings/session", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Ачаалахад алдаа");
        return;
      }
      const settings = data.settings as SessionSettings;
      writeCachedSessionSettings(settings);
      const next = clampIdleLogoutMinutes(settings.idleLogoutMinutes);
      setEnabled(next > 0);
      setMinutes(next > 0 ? next : DEFAULT_SESSION_SETTINGS.idleLogoutMinutes);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSavedMsg("");
    try {
      const idleLogoutMinutes = enabled
        ? clampIdleLogoutMinutes(minutes)
        : 0;
      if (enabled && idleLogoutMinutes <= 0) {
        setError("Идэвхтэй үед хугацаа хамгийн багадаа 1 минут байна");
        return;
      }
      const res = await fetch("/api/settings/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idleLogoutMinutes }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Хадгалахад алдаа");
        return;
      }
      writeCachedSessionSettings(data.settings);
      const next = clampIdleLogoutMinutes(data.settings.idleLogoutMinutes);
      setEnabled(next > 0);
      setMinutes(next > 0 ? next : DEFAULT_SESSION_SETTINGS.idleLogoutMinutes);
      setSavedMsg("Хадгаллаа");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <SettingsAdminRedirect />
      <PageHeader
        title="Сессийн тохиргоо"
        description="Идэвхгүй байдлын дараа автоматаар гарах хугацаа (минут)."
        actions={
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw size={14} /> Шинэчлэх
          </button>
        }
      />

      <SettingsNav />

      {error ? (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}
      {savedMsg ? (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {savedMsg}
        </div>
      ) : null}

      <section className="rounded-md border border-[var(--border)] bg-white">
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
          <Timer size={16} className="text-[var(--brand)]" />
          <h2 className="text-sm font-semibold">Auto logout (inactivity)</h2>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 p-4 text-sm text-[var(--muted)]">
            <Loader2 size={16} className="animate-spin" /> Ачаалж байна…
          </div>
        ) : (
          <form onSubmit={onSave} className="space-y-4 p-4">
            <label className="flex items-start gap-3 rounded-md border border-[var(--border)] px-3 py-3">
              <input
                type="checkbox"
                className="mt-1"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span>
                <span className="block text-sm font-semibold">
                  Идэвхгүй үед автоматаар гарах
                </span>
                <span className="mt-1 block text-xs text-[var(--muted)]">
                  Хулгана, гар, scroll, touch байхгүй болсон хугацаанд
                  хэрэглэгчийг системээс гаргана.
                </span>
              </span>
            </label>

            <div className={enabled ? "" : "pointer-events-none opacity-50"}>
              <div className="mb-2 text-sm font-medium">
                Идэвхгүй байдлын хугацаа (минут)
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                {IDLE_LOGOUT_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className={`btn ${minutes === preset ? "btn-primary" : ""}`}
                    onClick={() => setMinutes(preset)}
                    disabled={!enabled}
                  >
                    {preset} мин
                  </button>
                ))}
              </div>
              <label className="block max-w-xs text-sm">
                <span className="mb-1 block text-[var(--muted)]">
                  Өөр утга (1–480)
                </span>
                <input
                  type="number"
                  min={1}
                  max={480}
                  className="input"
                  value={minutes || ""}
                  disabled={!enabled}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setMinutes(0);
                      return;
                    }
                    setMinutes(clampIdleLogoutMinutes(raw));
                  }}
                />
              </label>
            </div>

            <div className="rounded-md border border-[var(--border)] bg-slate-50 px-3 py-2 text-xs text-[var(--muted)]">
              Одоогийн тохиргоо:{" "}
              <span className="font-semibold text-[var(--fg)]">
                {enabled
                  ? `${minutes} минутын идэвхгүй байдлын дараа гарна`
                  : "Автоматаар гарах унтраасан"}
              </span>
              . Зөвхөн админ хадгална; бүх нэвтэрсэн хэрэглэгчид мөрдөнө.
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                {saving ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                Хадгалах
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
