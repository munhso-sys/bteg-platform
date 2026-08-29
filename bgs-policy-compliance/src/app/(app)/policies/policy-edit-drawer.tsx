"use client";

import { Pencil, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { DateInput } from "@/components/ui/date-input";
import { withBasePath } from "@/lib/paths";

type PolicyMeta = {
  id: string;
  name: string;
  reference_code: string | null;
  approved_date: string | null;
  status: string;
};

type ClauseRow = {
  id: string;
  reference_number: string | null;
  text: string;
  depth: number;
};

type SectionBlock = {
  id: string;
  title: string;
  reference_number?: string | null;
  text?: string | null;
  clauses: ClauseRow[];
};

type DetailPayload = {
  ok: boolean;
  policy?: PolicyMeta;
  sections?: SectionBlock[];
  error?: string;
};

export type PolicyMetaUpdate = PolicyMeta;

export function PolicyEditButton({
  policyId,
  onMetaSaved,
}: {
  policyId: string;
  onMetaSaved?: (policy: PolicyMeta) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded border border-slate-300 p-1.5 text-slate-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700"
        title="Өөрчлөх"
        aria-label="Өөрчлөх"
      >
        <Pencil size={14} />
      </button>
      {open ? (
        <PolicyEditDrawer
          policyId={policyId}
          onClose={() => setOpen(false)}
          onMetaSaved={onMetaSaved}
        />
      ) : null}
    </>
  );
}

function PolicyEditDrawer({
  policyId,
  onClose,
  onMetaSaved,
}: {
  policyId: string;
  onClose: () => void;
  onMetaSaved?: (policy: PolicyMeta) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [policy, setPolicy] = useState<PolicyMeta | null>(null);
  const [sections, setSections] = useState<SectionBlock[]>([]);
  const [name, setName] = useState("");
  const [referenceCode, setReferenceCode] = useState("");
  const [approvedDate, setApprovedDate] = useState("");
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaMsg, setMetaMsg] = useState<string | null>(null);
  const [editingClauseId, setEditingClauseId] = useState<string | null>(null);
  const [editRef, setEditRef] = useState("");
  const [editText, setEditText] = useState("");
  const [clauseBusy, setClauseBusy] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editSecRef, setEditSecRef] = useState("");
  const [editSecText, setEditSecText] = useState("");
  const [sectionBusy, setSectionBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(withBasePath(`/api/policies/${policyId}`));
      const data = (await res.json()) as DetailPayload;
      if (!res.ok || !data.ok || !data.policy) {
        setError(data.error || "Ачаалж чадсангүй");
        return;
      }
      setPolicy(data.policy);
      setSections(data.sections ?? []);
      setName(data.policy.name);
      setReferenceCode(data.policy.reference_code ?? "");
      setApprovedDate(data.policy.approved_date?.slice(0, 10) ?? "");
    } catch {
      setError("Ачаалж чадсангүй");
    } finally {
      setLoading(false);
    }
  }, [policyId]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  async function saveMeta(e: React.FormEvent) {
    e.preventDefault();
    setSavingMeta(true);
    setMetaMsg(null);
    setError(null);
    try {
      const res = await fetch(withBasePath(`/api/policies/${policyId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          reference_code: referenceCode.trim() || null,
          approved_date: approvedDate || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Хадгалж чадсангүй");
        return;
      }
      setPolicy(data.policy);
      setName(data.policy.name);
      setReferenceCode(data.policy.reference_code ?? "");
      setApprovedDate(data.policy.approved_date?.slice(0, 10) ?? "");
      setMetaMsg("Хадгаллаа");
      onMetaSaved?.(data.policy as PolicyMeta);
      router.refresh();
    } catch {
      setError("Хадгалж чадсангүй");
    } finally {
      setSavingMeta(false);
    }
  }

  function startEditClause(c: ClauseRow) {
    setEditingClauseId(c.id);
    setEditRef(c.reference_number ?? "");
    setEditText(c.text);
  }

  function cancelEditClause() {
    setEditingClauseId(null);
    setEditRef("");
    setEditText("");
  }

  async function saveClause() {
    if (!editingClauseId) return;
    setClauseBusy(true);
    setError(null);
    try {
      const res = await fetch(withBasePath(`/api/clauses/${editingClauseId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: editText.trim(),
          reference_number: editRef.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Зүйл хадгалж чадсангүй");
        return;
      }
      cancelEditClause();
      await load();
      router.refresh();
    } catch {
      setError("Зүйл хадгалж чадсангүй");
    } finally {
      setClauseBusy(false);
    }
  }

  async function removeClause(clauseId: string, label: string) {
    if (!window.confirm(`"${label}" зүйл/заалтыг устгах уу?`)) return;
    setClauseBusy(true);
    setError(null);
    try {
      const res = await fetch(withBasePath(`/api/clauses/${clauseId}`), {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Устгаж чадсангүй");
        return;
      }
      if (editingClauseId === clauseId) cancelEditClause();
      await load();
      router.refresh();
    } catch {
      setError("Устгаж чадсангүй");
    } finally {
      setClauseBusy(false);
    }
  }

  function startEditSection(sec: SectionBlock) {
    if (sec.id === "orphan") return;
    setEditingSectionId(sec.id);
    setEditSecRef(sec.reference_number ?? "");
    setEditSecText(sec.text ?? "");
  }

  function cancelEditSection() {
    setEditingSectionId(null);
    setEditSecRef("");
    setEditSecText("");
  }

  async function saveSection() {
    if (!editingSectionId) return;
    if (!editSecText.trim()) {
      setError("Хэсгийн гарчиг заавал");
      return;
    }
    setSectionBusy(true);
    setError(null);
    try {
      const res = await fetch(withBasePath(`/api/sections/${editingSectionId}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: editSecText.trim(),
          reference_number: editSecRef.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Хэсэг хадгалж чадсангүй");
        return;
      }
      cancelEditSection();
      await load();
      router.refresh();
    } catch {
      setError("Хэсэг хадгалж чадсангүй");
    } finally {
      setSectionBusy(false);
    }
  }

  async function removeSection(sectionId: string, label: string) {
    if (sectionId === "orphan") return;
    if (
      !window.confirm(
        `"${label}" хэсгийг устгах уу? Доторх зүйлүүд хэсэггүй болно.`,
      )
    ) {
      return;
    }
    setSectionBusy(true);
    setError(null);
    try {
      const res = await fetch(withBasePath(`/api/sections/${sectionId}`), {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Хэсэг устгаж чадсангүй");
        return;
      }
      if (editingSectionId === sectionId) cancelEditSection();
      await load();
      router.refresh();
    } catch {
      setError("Хэсэг устгаж чадсангүй");
    } finally {
      setSectionBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Хаах"
        onClick={onClose}
      />
      <aside className="relative z-10 flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <div className="text-xs text-slate-500">Журам засварлах</div>
            <h2 className="truncate text-lg font-semibold">
              {policy?.name || "Ачаалж байна…"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 hover:bg-slate-100"
            aria-label="Хаах"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {loading ? (
            <p className="text-sm text-slate-500">Ачаалж байна…</p>
          ) : (
            <div className="space-y-6">
              {error ? (
                <p className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                  {error}
                </p>
              ) : null}

              <form onSubmit={saveMeta} className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-800">
                  Үндсэн мэдээлэл
                </h3>
                <label className="block text-sm">
                  <span className="text-xs text-slate-500">Журмын нэр</span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs text-slate-500">Журмын дугаар</span>
                  <input
                    value={referenceCode}
                    onChange={(e) => setReferenceCode(e.target.value)}
                    className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5 font-mono"
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-xs text-slate-500">Батлагдсан огноо</span>
                  <DateInput
                    value={approvedDate}
                    onChange={(e) => setApprovedDate(e.target.value)}
                    className="mt-0.5"
                  />
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={savingMeta}
                    className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                  >
                    {savingMeta ? "Хадгалж байна…" : "Хадгалах"}
                  </button>
                  {metaMsg ? (
                    <span className="text-xs text-emerald-700">{metaMsg}</span>
                  ) : null}
                </div>
              </form>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-800">
                  Зүйл, заалт
                </h3>
                {sections.length === 0 ? (
                  <p className="text-sm text-slate-500">Зүйл байхгүй</p>
                ) : (
                  sections.map((sec) => (
                    <div key={sec.id} className="space-y-1">
                      {editingSectionId === sec.id ? (
                        <div className="space-y-2 rounded border border-slate-200 bg-slate-50 p-2">
                          <input
                            value={editSecRef}
                            onChange={(e) => setEditSecRef(e.target.value)}
                            placeholder="Хэсгийн дугаар (жишээ: 1)"
                            className="w-full rounded border border-slate-300 px-2 py-1 font-mono text-sm"
                          />
                          <input
                            value={editSecText}
                            onChange={(e) => setEditSecText(e.target.value)}
                            placeholder="Хэсгийн нэр"
                            required
                            className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              disabled={sectionBusy || !editSecText.trim()}
                              onClick={() => void saveSection()}
                              className="rounded bg-slate-900 px-2.5 py-1 text-xs text-white disabled:opacity-50"
                            >
                              Хадгалах
                            </button>
                            <button
                              type="button"
                              disabled={sectionBusy}
                              onClick={cancelEditSection}
                              className="rounded border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-50"
                            >
                              Болих
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                            {sec.title}
                          </div>
                          {sec.id !== "orphan" ? (
                            <div className="flex shrink-0 gap-1">
                              <button
                                type="button"
                                disabled={sectionBusy}
                                onClick={() => startEditSection(sec)}
                                className="rounded border border-slate-300 p-1 text-slate-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 disabled:opacity-50"
                                title="Хэсэг засах"
                                aria-label="Хэсэг засах"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                type="button"
                                disabled={sectionBusy}
                                onClick={() =>
                                  void removeSection(sec.id, sec.title)
                                }
                                className="rounded border border-slate-300 p-1 text-slate-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                                title="Хэсэг устгах"
                                aria-label="Хэсэг устгах"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      )}
                      <ul className="divide-y divide-slate-100 rounded border border-slate-200">
                        {sec.clauses.map((c) => {
                          const editing = editingClauseId === c.id;
                          return (
                            <li
                              key={c.id}
                              className="px-2 py-2"
                              style={{ paddingLeft: `${c.depth * 12 + 8}px` }}
                            >
                              {editing ? (
                                <div className="space-y-2">
                                  <input
                                    value={editRef}
                                    onChange={(e) => setEditRef(e.target.value)}
                                    placeholder="Зүйл / заалтын дугаар"
                                    className="w-full rounded border border-slate-300 px-2 py-1 font-mono text-sm"
                                  />
                                  <textarea
                                    value={editText}
                                    onChange={(e) => setEditText(e.target.value)}
                                    rows={3}
                                    required
                                    className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      disabled={clauseBusy || !editText.trim()}
                                      onClick={() => void saveClause()}
                                      className="rounded bg-slate-900 px-2.5 py-1 text-xs text-white disabled:opacity-50"
                                    >
                                      Хадгалах
                                    </button>
                                    <button
                                      type="button"
                                      disabled={clauseBusy}
                                      onClick={cancelEditClause}
                                      className="rounded border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-50"
                                    >
                                      Болих
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 text-sm">
                                    <span className="mr-2 font-mono text-xs text-slate-500">
                                      {c.reference_number || "—"}
                                    </span>
                                    <span className="text-slate-800">
                                      {c.text || "(хоосон)"}
                                    </span>
                                  </div>
                                  <div className="flex shrink-0 gap-1">
                                    <button
                                      type="button"
                                      disabled={clauseBusy}
                                      onClick={() => startEditClause(c)}
                                      className="rounded border border-slate-300 p-1 text-slate-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 disabled:opacity-50"
                                      title="Засах"
                                      aria-label="Засах"
                                    >
                                      <Pencil size={13} />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={clauseBusy}
                                      onClick={() =>
                                        void removeClause(
                                          c.id,
                                          c.reference_number || c.text.slice(0, 40),
                                        )
                                      }
                                      className="rounded border border-slate-300 p-1 text-slate-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
                                      title="Устгах"
                                      aria-label="Устгах"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
