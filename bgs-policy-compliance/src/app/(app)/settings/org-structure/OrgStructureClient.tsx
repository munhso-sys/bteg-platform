"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { Panel } from "@/components/ui/primitives";
import { withBasePath } from "@/lib/paths";

type Alba = { id: string; name: string };
type Heltes = { id: string; name: string; albas: Alba[] };
type OrgLabel = { id: string; name: string };

export function OrgStructureClient() {
  const [organizations, setOrganizations] = useState<OrgLabel[]>([]);
  const [heltes, setHeltes] = useState<Heltes[]>([]);
  const [openHeltes, setOpenHeltes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const [newOrgName, setNewOrgName] = useState("");
  const [newHeltesName, setNewHeltesName] = useState("");
  const [newHeltesAlbaName, setNewHeltesAlbaName] = useState("");
  const [newAlbaHeltesId, setNewAlbaHeltesId] = useState("");
  const [newAlbaName, setNewAlbaName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(withBasePath("/api/org/units?view=managed"), {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Нэгжийн жагсаалт уншигдсангүй");
      }
      setOrganizations(data.organizations ?? []);
      setHeltes(data.heltes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  function toggleHeltes(id: string) {
    setOpenHeltes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function create(kind: "organization" | "heltes" | "alba") {
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      let body: Record<string, unknown>;
      if (kind === "organization") {
        if (!newOrgName.trim()) throw new Error("Байгууллагын нэр оруулна уу");
        body = { kind, name: newOrgName.trim() };
      } else if (kind === "heltes") {
        if (!newHeltesName.trim()) throw new Error("Хэлтэсийн нэр оруулна уу");
        body = {
          kind,
          name: newHeltesName.trim(),
          alba_name: newHeltesAlbaName.trim() || null,
        };
      } else {
        if (!newAlbaHeltesId || !newAlbaName.trim()) {
          throw new Error("Хэлтэс сонгоод албаны нэр оруулна уу");
        }
        body = {
          kind,
          heltes_id: newAlbaHeltesId,
          name: newAlbaName.trim(),
        };
      }
      const res = await fetch(withBasePath("/api/org/units"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Үүсгэж чадсангүй");
      if (kind === "organization") {
        setOkMsg(`Байгууллага нэмлээ: ${data.name}`);
        setNewOrgName("");
      } else if (kind === "heltes") {
        setOkMsg(`Хэлтэс нэмлээ: ${data.heltesName}`);
        setNewHeltesName("");
        setNewHeltesAlbaName("");
        if (data.heltesId) {
          setOpenHeltes((prev) => new Set(prev).add(data.heltesId));
        }
      } else {
        setOkMsg(`Алба нэмлээ: ${data.albaName}`);
        setNewAlbaName("");
        setOpenHeltes((prev) => new Set(prev).add(data.heltesId));
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа");
    } finally {
      setBusy(false);
    }
  }

  async function remove(body: Record<string, unknown>, label: string) {
    if (
      !confirm(
        `${label} устгах уу?\nХолбоотой журам/ажлын байр «Бусад» руу шилжинэ.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setOkMsg(null);
    try {
      const res = await fetch(withBasePath("/api/org/units"), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Устгаж чадсангүй");
      setOkMsg(`${label} устгалаа.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа");
    } finally {
      setBusy(false);
    }
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
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-sm hover:bg-slate-50"
          onClick={() => void load()}
        >
          <RefreshCw size={14} /> Шинэчлэх
        </button>
        {okMsg ? <span className="text-sm text-emerald-700">{okMsg}</span> : null}
        {error ? <span className="text-sm text-rose-600">{error}</span> : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel title="Байгууллага нэмэх">
          <div className="space-y-2">
            <input
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="Байгууллагын нэр"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void create("organization")}
              className="inline-flex items-center gap-1.5 rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              <Plus size={14} /> Нэмэх
            </button>
          </div>
        </Panel>

        <Panel title="Хэлтэс нэмэх">
          <div className="space-y-2">
            <input
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="Хэлтэсийн нэр"
              value={newHeltesName}
              onChange={(e) => setNewHeltesName(e.target.value)}
            />
            <input
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="Эхний албаны нэр (заавал биш)"
              value={newHeltesAlbaName}
              onChange={(e) => setNewHeltesAlbaName(e.target.value)}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void create("heltes")}
              className="inline-flex items-center gap-1.5 rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              <Plus size={14} /> Нэмэх
            </button>
          </div>
        </Panel>

        <Panel title="Алба нэмэх">
          <div className="space-y-2">
            <select
              className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm"
              value={newAlbaHeltesId}
              onChange={(e) => setNewAlbaHeltesId(e.target.value)}
            >
              <option value="">— хэлтэс сонгох —</option>
              {heltes.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
            <input
              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              placeholder="Албаны нэр"
              value={newAlbaName}
              onChange={(e) => setNewAlbaName(e.target.value)}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void create("alba")}
              className="inline-flex items-center gap-1.5 rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              <Plus size={14} /> Нэмэх
            </button>
          </div>
        </Panel>
      </div>

      <Panel title="Байгууллагууд">
        {organizations.length === 0 ? (
          <p className="text-sm text-slate-500">
            Бүртгэлтэй байгууллага алга. Дээрээс нэмнэ үү.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {organizations.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-2 py-2 text-sm"
              >
                <span className="font-medium">{o.name}</span>
                <button
                  type="button"
                  disabled={busy}
                  title="Устгах"
                  className="rounded border border-rose-200 p-1.5 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                  onClick={() =>
                    void remove(
                      { kind: "organization", id: o.id },
                      `«${o.name}» байгууллага`,
                    )
                  }
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Хэлтэс · алба">
        <p className="mb-3 text-xs text-slate-500">
          Буруу нэмэгдсэн алба (жнь. «БҮГД»)-ыг эндээс устгана. Системийн
          «Бусад», «нийтлэг журам» мөрүүдийг устгахгүй.
        </p>
        <div className="space-y-1">
          {heltes.map((h) => {
            const open = openHeltes.has(h.id);
            return (
              <div key={h.id} className="rounded border border-slate-200">
                <div className="flex items-center gap-1 bg-slate-50 px-2 py-1.5">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-semibold"
                    onClick={() => toggleHeltes(h.id)}
                  >
                    {open ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                    {open ? (
                      <FolderOpen size={16} className="text-orange-500" />
                    ) : (
                      <Folder size={16} className="text-slate-400" />
                    )}
                    <span className="truncate">{h.name}</span>
                    <span className="text-xs font-normal text-slate-500">
                      {h.albas.length} алба
                    </span>
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    title="Хэлтэс устгах"
                    className="rounded border border-rose-200 p-1.5 text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                    onClick={() =>
                      void remove(
                        { kind: "heltes", heltes_id: h.id },
                        `«${h.name}» хэлтэс`,
                      )
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                {open ? (
                  <ul className="divide-y divide-slate-100 px-2 py-1">
                    {h.albas.map((a) => (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-2 py-1.5 pl-8 text-sm"
                      >
                        <span>{a.name}</span>
                        <button
                          type="button"
                          disabled={busy || h.albas.length <= 1}
                          title={
                            h.albas.length <= 1
                              ? "Сүүлийн албыг устгахгүй"
                              : "Алба устгах"
                          }
                          className="rounded border border-rose-200 p-1.5 text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                          onClick={() =>
                            void remove(
                              {
                                kind: "alba",
                                heltes_id: h.id,
                                alba_id: a.id,
                              },
                              `«${a.name}» алба`,
                            )
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
