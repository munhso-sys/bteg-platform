"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { ManagementNav } from "@/components/management/ManagementNav";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/cn";
import {
  AI_DATA_SOURCES,
  AI_ROLE_OPTIONS,
  AI_SOURCE_LABELS,
  DEFAULT_AI_SCOPE_CONFIG,
  type AiDataSource,
  type AiScopeConfig,
} from "@/lib/ai/scope-config";
import type { RoleId } from "@/lib/rbac/types";

export default function ManagementAiScopePage() {
  const [config, setConfig] = useState<AiScopeConfig>(DEFAULT_AI_SCOPE_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [okMsg, setOkMsg] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/management-center/ai-scope", {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Ачаалахад алдаа");
        return;
      }
      setConfig(data.config);
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

  function toggleRole(list: "fullAccessRoles" | "unitScopedRoles", roleId: RoleId) {
    if (list === "fullAccessRoles" && roleId === "admin") return;
    setConfig((prev) => {
      const has = prev[list].includes(roleId);
      const nextList = has
        ? prev[list].filter((id) => id !== roleId)
        : [...prev[list], roleId];
      return { ...prev, [list]: nextList };
    });
    setOkMsg("");
  }

  function toggleSource(source: AiDataSource) {
    setConfig((prev) => ({
      ...prev,
      sources: { ...prev.sources, [source]: !prev.sources[source] },
    }));
    setOkMsg("");
  }

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    setSaving(true);
    setError("");
    setOkMsg("");
    try {
      const res = await fetch("/api/management-center/ai-scope", {
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
      setOkMsg("Хадгаллаа");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="AI мэдээллийн эрх"
        description="AI Туслах ямар модулийн өгөгдөл унших, Admin бүх мэдээлэлтэй / бусад хэрэглэгч зөвхөн өөрийн алба·хэлтэстэй холбогдох эсэхийг тохируулна."
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void load()}
              disabled={loading || saving}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Шинэчлэх
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void save()}
              disabled={loading || saving}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Хадгалах
            </button>
          </div>
        }
      />
      <ManagementNav />

      {error ? (
        <p className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {okMsg ? (
        <p className="mb-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-800 dark:text-emerald-200">
          {okMsg}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Ачаалж байна…
        </div>
      ) : (
        <form className="space-y-6" onSubmit={(e) => void save(e)}>
          <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <h2 className="text-base font-semibold text-[var(--fg)]">
              Бүх мэдээлэлтэй холбогдох роль
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Эдгээр роль AI-аар платформын бүх алба·хэлтэсийн өгөгдөл асууж болно.
              Admin үргэлж орно.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {AI_ROLE_OPTIONS.map((role) => {
                const checked = config.fullAccessRoles.includes(role.id);
                const locked = role.id === "admin";
                return (
                  <label
                    key={`full-${role.id}`}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm",
                      checked && "border-[var(--accent)]/40 bg-[var(--accent)]/5",
                      locked && "opacity-80",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={locked}
                      onChange={() => toggleRole("fullAccessRoles", role.id)}
                    />
                    <span>{role.label}</span>
                    <span className="text-xs text-[var(--muted)]">({role.id})</span>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <h2 className="text-base font-semibold text-[var(--fg)]">
              Нэгжийн хүрээнд хязгаарлах роль
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Эдгээр роль зөвхөн өөрийн алба·хэлтэсийн мэдээлэлтэй холбогдоно.
              Оноолгоогүй бол нэгжийн баримт тоо харагдахгүй.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {AI_ROLE_OPTIONS.map((role) => {
                const checked = config.unitScopedRoles.includes(role.id);
                return (
                  <label
                    key={`unit-${role.id}`}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm",
                      checked && "border-[var(--accent)]/40 bg-[var(--accent)]/5",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRole("unitScopedRoles", role.id)}
                    />
                    <span>{role.label}</span>
                    <span className="text-xs text-[var(--muted)]">({role.id})</span>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
            <h2 className="text-base font-semibold text-[var(--fg)]">
              AI-д нээлттэй мэдээллийн эх үүсвэр
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Идэвхгүй эх үүсвэрийг AI контекстэд оруулахгүй. Тоо/KPI болон
              агуулгын хайлт (заалт, олдвор) тусдаа асаана. Журам / ХШ өгөгдөл
              Supabase <code className="text-xs">app_data_store</code>-оос
              уншина.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {AI_DATA_SOURCES.map((source) => (
                <label
                  key={source}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm",
                    config.sources[source] &&
                      "border-[var(--accent)]/40 bg-[var(--accent)]/5",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={config.sources[source]}
                    onChange={() => toggleSource(source)}
                  />
                  <span>{AI_SOURCE_LABELS[source]}</span>
                  <span className="text-xs text-[var(--muted)]">({source})</span>
                </label>
              ))}
            </div>
          </section>

          <p className="text-xs text-[var(--muted)]">
            Сүүлийн шинэчлэл:{" "}
            {config.updatedAt
              ? new Date(config.updatedAt).toLocaleString("mn-MN")
              : "—"}
            . Тохиргоо:{" "}
            <code>platform_ai_data_scope</code>
          </p>
        </form>
      )}
    </div>
  );
}
