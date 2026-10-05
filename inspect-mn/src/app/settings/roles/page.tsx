"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { SettingsAdminRedirect } from "@/components/settings/SettingsAdminRedirect";

type Role = { id: string; label: string; description: string | null; sort_order: number };
type Permission = {
  id: string;
  label: string;
  module: string;
  description: string | null;
};

const MODULE_LABELS: Record<string, string> = {
  portal: "Портал",
  "policy-compliance": "Журмын биелэлт",
  inspection: "Хяналт шалгалт",
  development: "Судалгаа хөгжүүлэлт",
  guidance: "Удирдамж",
  voice: "Ажилтны дуу хоолой",
  ai: "AI туслах",
  review: "Баримт харьцуулалт",
  glossary: "Толь бичиг",
  result: "Үр дүн",
  smartmine: "SmartMine",
  tools: "Tools",
};

export default function RolePermissionsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [matrix, setMatrix] = useState<Record<string, string[]>>({});
  const [baseId, setBaseId] = useState("module.policy.view");
  const [roleId, setRoleId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setSavedMsg("");
    try {
      const res = await fetch("/api/admin/role-permissions", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Ачаалахад алдаа");
        return;
      }
      const nextRoles = (data.roles ?? []) as Role[];
      setRoles(nextRoles);
      setPermissions(data.permissions ?? []);
      setMatrix(data.matrix ?? {});
      setBaseId(data.base_permission_id ?? "module.policy.view");
      setRoleId((prev) => prev || nextRoles[0]?.id || "");
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

  useEffect(() => {
    if (!roleId) return;
    const ids = matrix[roleId] ?? [];
    const timer = window.setTimeout(() => {
      setSelected(new Set(ids));
      setSavedMsg("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [roleId, matrix]);

  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of permissions) {
      const list = map.get(p.module) ?? [];
      list.push(p);
      map.set(p.module, list);
    }
    return Array.from(map.entries());
  }, [permissions]);

  const activeRole = roles.find((r) => r.id === roleId);

  function toggle(permId: string) {
    if (permId === baseId) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
    setSavedMsg("");
  }

  async function save() {
    if (!roleId) return;
    setSaving(true);
    setError("");
    setSavedMsg("");
    try {
      const res = await fetch("/api/admin/role-permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_id: roleId,
          permission_ids: Array.from(selected),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Хадгалахад алдаа");
        return;
      }
      setMatrix((prev) => ({
        ...prev,
        [roleId]: data.permission_ids ?? Array.from(selected),
      }));
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
        title="Role эрхийн тохиргоо"
        description="Үндсэн эрх: холбогдох журмын заалт харах. Нэмэлт эрхийг role тус бүрээр сонгоно."
        actions={
          <button type="button" className="btn btn-ghost" onClick={() => void load()}>
            <RefreshCw size={14} /> Шинэчлэх
          </button>
        }
      />
      <SettingsNav />

      <div className="mb-4 rounded-md border border-[var(--border)] bg-white p-3 text-sm text-[var(--muted)]">
        Бүх role дээр <strong className="text-[var(--fg)]">Журмын биелэлт · харах</strong> үндсэн
        эрхээр үлдэнэ. Доорх нэмэлт эрхүүдийг сонгож хадгална.
      </div>

      {error ? (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <Loader2 size={16} className="animate-spin" /> Ачаалж байна…
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <aside className="rounded-md border border-[var(--border)] bg-white">
            <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold">
              Role
            </div>
            <div className="max-h-[28rem] overflow-y-auto p-1">
              {roles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRoleId(r.id)}
                  className={`mb-0.5 w-full rounded-md px-3 py-2 text-left text-sm ${
                    roleId === r.id
                      ? "bg-[var(--brand)] text-white"
                      : "hover:bg-slate-50 text-[var(--fg)]"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </aside>

          <section className="rounded-md border border-[var(--border)] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
              <div>
                <div className="text-sm font-semibold">
                  {activeRole?.label ?? "Role сонгоно уу"}
                </div>
                {activeRole?.description ? (
                  <div className="text-xs text-[var(--muted)]">{activeRole.description}</div>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                {savedMsg ? (
                  <span className="text-xs text-emerald-700">{savedMsg}</span>
                ) : null}
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!roleId || saving}
                  onClick={() => void save()}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Хадгалах
                </button>
              </div>
            </div>

            <div className="space-y-5 p-4">
              {grouped.map(([module, perms]) => (
                <div key={module}>
                  <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--brand)]">
                    {MODULE_LABELS[module] ?? module}
                  </div>
                  <div className="space-y-2">
                    {perms.map((perm) => {
                      const locked = perm.id === baseId;
                      const checked = locked || selected.has(perm.id);
                      return (
                        <label
                          key={perm.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 text-sm ${
                            checked
                              ? "border-amber-200 bg-amber-50/60"
                              : "border-[var(--border)] bg-white"
                          } ${locked ? "opacity-90" : ""}`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={checked}
                            disabled={locked}
                            onChange={() => toggle(perm.id)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="font-medium text-[var(--fg)]">
                              {perm.label}
                              {locked ? (
                                <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                                  үндсэн
                                </span>
                              ) : null}
                            </span>
                            {perm.description ? (
                              <span className="mt-0.5 block text-xs text-[var(--muted)]">
                                {perm.description}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
