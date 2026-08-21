"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Save, Trash2 } from "lucide-react";
import { Panel } from "@/components/ui/primitives";
import type { OrgTemplateAllocation } from "@/lib/org-template/types";

type TemplateItem = {
  id: string;
  title: string;
  code: string | null;
};

type Alba = { id: string; name: string };
type Heltes = { id: string; name: string; albas: Alba[] };

export function OrgTemplatesClient() {
  const [heltes, setHeltes] = useState<Heltes[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [allocations, setAllocations] = useState<OrgTemplateAllocation[]>([]);
  const [heltesId, setHeltesId] = useState("");
  const [albaId, setAlbaId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catRes, allocRes] = await Promise.all([
        fetch("/api/org-template-catalog", { cache: "no-store" }),
        fetch("/api/org-template-allocations", { cache: "no-store" }),
      ]);
      const catalog = await catRes.json();
      const alloc = await allocRes.json();
      if (!catRes.ok || !catalog.ok) {
        throw new Error(catalog.error || "Каталог уншигдсангүй");
      }
      if (!allocRes.ok || !alloc.ok) {
        throw new Error(alloc.error || "Холболт уншигдсангүй");
      }
      setHeltes(catalog.heltes ?? []);
      setTemplates(catalog.templates ?? []);
      setAllocations(alloc.allocations ?? []);
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

  const albas = useMemo(() => {
    return heltes.find((h) => h.id === heltesId)?.albas ?? [];
  }, [heltes, heltesId]);

  const heltesName = heltes.find((h) => h.id === heltesId)?.name ?? "";
  const albaName = albas.find((a) => a.id === albaId)?.name ?? "";

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (!heltesId || !albaId) {
        setSelected(new Set());
        return;
      }
      const row = allocations.find(
        (a) => a.heltesId === heltesId && a.albaId === albaId,
      );
      setSelected(new Set(row?.templateIds ?? []));
    }, 0);
    return () => window.clearTimeout(id);
  }, [heltesId, albaId, allocations]);

  const filteredTemplates = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return templates;
    return templates.filter(
      (t) =>
        t.title.toLowerCase().includes(s) ||
        (t.code ?? "").toLowerCase().includes(s),
    );
  }, [templates, q]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    if (!heltesId || !albaId) {
      setError("Хэлтэс болон алба сонгоно уу");
      return;
    }
    setSaving(true);
    setError(null);
    setOkMsg(null);
    try {
      const selectedTemplates = templates
        .filter((t) => selected.has(t.id))
        .map((t) => ({
          id: t.id,
          title: t.title,
          code: t.code,
        }));
      const res = await fetch("/api/org-template-allocations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heltesId,
          heltesName,
          albaId,
          albaName,
          templates: selectedTemplates,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Хадгалж чадсангүй");
      }
      setOkMsg("Холболт хадгалагдлаа.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа");
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(hId: string, aId: string) {
    if (!confirm("Энэ холболтыг устгах уу?")) return;
    setError(null);
    const res = await fetch(
      `/api/org-template-allocations?heltesId=${encodeURIComponent(hId)}&albaId=${encodeURIComponent(aId)}`,
      { method: "DELETE" },
    );
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error || "Устгаж чадсангүй");
      return;
    }
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
        <Loader2 size={16} className="animate-spin" /> Уншиж байна…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn btn-ghost" onClick={() => void load()}>
          <RefreshCw size={14} /> Шинэчлэх
        </button>
        {okMsg ? <span className="text-sm text-emerald-700">{okMsg}</span> : null}
        {error ? <span className="text-sm text-rose-600">{error}</span> : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
        <Panel title="Нэгж сонгох">
          <label className="mb-3 block text-sm">
            <span className="mb-1 block font-medium">Хэлтэс</span>
            <select
              className="input w-full"
              value={heltesId}
              onChange={(e) => {
                setHeltesId(e.target.value);
                setAlbaId("");
              }}
            >
              <option value="">— сонгох —</option>
              {heltes.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Алба</span>
            <select
              className="input w-full"
              value={albaId}
              disabled={!heltesId}
              onChange={(e) => setAlbaId(e.target.value)}
            >
              <option value="">— сонгох —</option>
              {albas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-3 text-xs text-[var(--muted)]">
            Сонгосон албанд холбох ХШ хуудсыг баруун талаас тэмдэглээд хадгална.
            Нэгжийн дарга / Ахлах мэргэжилтэн зөвхөн эдгээр холболтоор ХШ
            мэдээлэл харна (засах эрхгүй).
          </p>
        </Panel>

        <Panel
          title="ХШ хуудас хувиарлах"
          actions={
            <button
              type="button"
              className="btn btn-primary"
              disabled={saving || !heltesId || !albaId}
              onClick={() => void save()}
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}{" "}
              Хадгалах ({selected.size})
            </button>
          }
        >
          {!heltesId || !albaId ? (
            <p className="text-sm text-[var(--muted)]">
              Эхлээд хэлтэс, алба сонгоно уу.
            </p>
          ) : (
            <>
              <input
                className="input mb-3 w-full max-w-md"
                placeholder="ХШ хуудас хайх…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <div className="max-h-[28rem] overflow-auto rounded-md border border-[var(--border)]">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-[var(--card)] text-xs uppercase text-[var(--muted)]">
                    <tr>
                      <th className="w-10 px-2 py-2" />
                      <th className="px-2 py-2">ХШ хуудас</th>
                      <th className="px-2 py-2">Код</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTemplates.map((t) => (
                      <tr
                        key={t.id}
                        className="border-t border-[var(--border)] hover:bg-[var(--surface-muted)]"
                      >
                        <td className="px-2 py-1.5">
                          <input
                            type="checkbox"
                            checked={selected.has(t.id)}
                            onChange={() => toggle(t.id)}
                          />
                        </td>
                        <td className="px-2 py-1.5 font-medium">{t.title}</td>
                        <td className="px-2 py-1.5 text-[var(--muted)]">
                          {t.code || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>
      </div>

      <Panel title="Бүртгэгдсэн холболт">
        {allocations.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Одоогоор холболт байхгүй.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-2">Хэлтэс</th>
                  <th className="py-2 pr-2">Алба</th>
                  <th className="py-2 pr-2">ХШ хуудас</th>
                  <th className="py-2 pr-2">Шинэчилсэн</th>
                  <th className="py-2 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((a) => (
                  <tr key={a.id} className="border-b border-[var(--border)]">
                    <td className="py-2 pr-2">{a.heltesName}</td>
                    <td className="py-2 pr-2 font-medium">{a.albaName}</td>
                    <td className="py-2 pr-2">
                      <div className="flex flex-wrap gap-1">
                        {a.templates.length === 0 ? (
                          <span className="text-[var(--muted)]">—</span>
                        ) : (
                          a.templates.map((t) => (
                            <span
                              key={t.id}
                              className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-xs"
                              title={t.code || undefined}
                            >
                              {t.code ? `${t.code} · ` : ""}
                              {t.title}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-2 text-[var(--muted)]">
                      {a.updatedAt.slice(0, 16).replace("T", " ")}
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        title="Устгах"
                        onClick={() => void removeRow(a.heltesId, a.albaId)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
