"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Save, Trash2 } from "lucide-react";
import { Panel } from "@/components/ui/primitives";

type PolicyItem = {
  id: string;
  name: string;
  reference_code: string | null;
};

type Alba = { id: string; name: string };
type Heltes = { id: string; name: string; albas: Alba[] };

type AllocationRow = {
  heltesId: string;
  heltesName: string;
  albaId: string;
  albaName: string;
  policies: PolicyItem[];
};

export function OrgPoliciesClient() {
  const [heltes, setHeltes] = useState<Heltes[]>([]);
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [allocations, setAllocations] = useState<AllocationRow[]>([]);
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
      const [orgRes, allocRes] = await Promise.all([
        fetch("/api/org/access-options", { cache: "no-store" }),
        fetch("/api/org/policy-allocations", { cache: "no-store" }),
      ]);
      const org = await orgRes.json();
      const alloc = await allocRes.json();
      if (!orgRes.ok || !org.ok) {
        throw new Error(org.error || "Нэгжийн жагсаалт уншигдсангүй");
      }
      if (!allocRes.ok || !alloc.ok) {
        throw new Error(alloc.error || "Холболт уншигдсангүй");
      }
      setHeltes(org.heltes ?? []);
      setPolicies(alloc.policies ?? []);
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
      setSelected(new Set(row?.policies.map((p) => p.id) ?? []));
    }, 0);
    return () => window.clearTimeout(id);
  }, [heltesId, albaId, allocations]);

  const filteredPolicies = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return policies;
    return policies.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        (p.reference_code ?? "").toLowerCase().includes(s),
    );
  }, [policies, q]);

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
      const policyNames: Record<string, string> = {};
      for (const p of policies) {
        if (selected.has(p.id)) policyNames[p.id] = p.name;
      }
      const res = await fetch("/api/org/policy-allocations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          heltesId,
          albaId,
          policyIds: [...selected],
          policyNames,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Хадгалж чадсангүй");
      }
      setOkMsg("Холболт хадгалагдлаа.");
      setAllocations(data.allocations ?? []);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа");
    } finally {
      setSaving(false);
    }
  }

  async function clearUnit(hId: string, aId: string) {
    if (!confirm("Энэ нэгжийн журмын холболтыг цэвэрлэх үү?")) return;
    setError(null);
    const res = await fetch("/api/org/policy-allocations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        heltesId: hId,
        albaId: aId,
        policyIds: [],
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error || "Цэвэрлэж чадсангүй");
      return;
    }
    await load();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 size={16} className="animate-spin" /> Уншиж байна…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn" onClick={() => void load()}>
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
          <p className="mt-3 text-xs text-slate-500">
            Сонгосон албанд холбох журмуудыг баруун талаас тэмдэглээд хадгална.
            Нэгжийн дарга / Ахлах мэргэжилтэн зөвхөн холбогдсон журмын хүрээнд
            мэдээлэл харна (засах эрхгүй).
          </p>
          {heltesName && albaName ? (
            <p className="mt-2 text-xs font-medium text-slate-700">
              {heltesName} · {albaName}
            </p>
          ) : null}
        </Panel>

        <Panel
          title="Журам хувиарлах"
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
            <p className="text-sm text-slate-500">
              Эхлээд хэлтэс, алба сонгоно уу.
            </p>
          ) : (
            <>
              <input
                className="input mb-3 w-full max-w-md"
                placeholder="Журам хайх…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <div className="max-h-[28rem] overflow-auto rounded-md border border-slate-200">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-white text-xs uppercase text-slate-500">
                    <tr>
                      <th className="w-10 px-2 py-2" />
                      <th className="px-2 py-2">Журам</th>
                      <th className="px-2 py-2">Код</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPolicies.map((p) => (
                      <tr
                        key={p.id}
                        className="border-t border-slate-100 hover:bg-slate-50"
                      >
                        <td className="px-2 py-1.5">
                          <input
                            type="checkbox"
                            checked={selected.has(p.id)}
                            onChange={() => toggle(p.id)}
                          />
                        </td>
                        <td className="px-2 py-1.5 font-medium">{p.name}</td>
                        <td className="px-2 py-1.5 text-slate-500">
                          {p.reference_code || "—"}
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
          <p className="text-sm text-slate-500">Одоогоор холболт байхгүй.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-2">Хэлтэс</th>
                  <th className="py-2 pr-2">Алба</th>
                  <th className="py-2 pr-2">Журам</th>
                  <th className="py-2 text-right"> </th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((a) => (
                  <tr
                    key={`${a.heltesId}::${a.albaId}`}
                    className="border-b border-slate-100"
                  >
                    <td className="py-2 pr-2">{a.heltesName}</td>
                    <td className="py-2 pr-2 font-medium">{a.albaName}</td>
                    <td className="py-2 pr-2">
                      <div className="flex flex-wrap gap-1">
                        {a.policies.length === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          a.policies.map((p) => (
                            <span
                              key={p.id}
                              className="rounded bg-slate-100 px-1.5 py-0.5 text-xs"
                              title={p.reference_code || undefined}
                            >
                              {p.name}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        className="btn"
                        title="Цэвэрлэх"
                        onClick={() => void clearUnit(a.heltesId, a.albaId)}
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
