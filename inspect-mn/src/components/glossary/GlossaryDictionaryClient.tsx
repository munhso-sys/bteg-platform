"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/cn";
import { groupByMnLetter } from "@/lib/glossary/terms";
import type { GlossaryTerm } from "@/lib/glossary/types";

type GlossaryPayload = {
  ok: boolean;
  canEdit?: boolean;
  termCount?: number;
  letters?: string[];
  terms?: GlossaryTerm[];
  error?: string;
};

type Draft = {
  mn: string;
  en: string;
  abbr: string;
  definition: string;
};

function preview(text: string, max = 88) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max)}…`;
}

function TermRow({
  no,
  term,
  canEdit,
  expanded,
  onToggle,
  onSaved,
}: {
  no: number;
  term: GlossaryTerm;
  canEdit: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSaved: (term: GlossaryTerm) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    mn: term.mn,
    en: term.en,
    abbr: term.abbr,
    definition: term.definition,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function saveAll() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/glossary/terms/${term.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = (await res.json()) as {
        ok: boolean;
        term?: GlossaryTerm;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.term) {
        throw new Error(data.error ?? "Хадгалахад алдаа");
      }
      onSaved(data.term);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хадгалахад алдаа");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <tr
        className={cn(
          "border-b border-[var(--border)] transition-colors hover:bg-[var(--bg)]/70",
          expanded && "bg-[var(--bg)]/40",
        )}
      >
        <td className="w-14 px-3 py-2.5 align-top text-xs text-[var(--muted)]">
          {no}
        </td>
        <td className="min-w-[160px] px-3 py-2.5 align-top text-sm font-medium text-[var(--brand)]">
          {term.mn || "—"}
        </td>
        <td className="min-w-[160px] px-3 py-2.5 align-top text-sm text-[var(--fg)]">
          {term.en || "—"}
        </td>
        <td className="w-28 px-3 py-2.5 align-top text-xs text-[var(--muted)]">
          {term.abbr || "—"}
        </td>
        <td className="min-w-[240px] px-3 py-2.5 align-top">
          <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-start gap-2 text-left text-sm text-[var(--muted)]"
          >
            {expanded ? (
              <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand)]" />
            ) : (
              <ChevronRight className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{preview(term.definition) || "Тайлбар байхгүй"}</span>
          </button>
        </td>
      </tr>
      {expanded ? (
        <tr className="border-b border-[var(--border)] bg-[var(--card)]">
          <td colSpan={5} className="px-4 py-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Дэлгэрэнгүй / засвар
                </p>
                {canEdit ? (
                  <div className="flex items-center gap-2">
                    {editing ? (
                      <>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            setEditing(false);
                            setError("");
                          }}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1 text-xs"
                        >
                          <X className="h-3.5 w-3.5" />
                          Болих
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={saveAll}
                          className="inline-flex items-center gap-1 rounded-md bg-[var(--brand)] px-2.5 py-1 text-xs text-white disabled:opacity-60"
                        >
                          {saving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                          Хадгалах
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setDraft({
                            mn: term.mn,
                            en: term.en,
                            abbr: term.abbr,
                            definition: term.definition,
                          });
                          setEditing(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] px-2.5 py-1 text-xs"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Засах
                      </button>
                    )}
                  </div>
                ) : null}
              </div>

              {editing ? (
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="block space-y-1">
                    <span className="text-xs text-[var(--muted)]">Монгол үг</span>
                    <input
                      value={draft.mn}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, mn: e.target.value }))
                      }
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-[var(--muted)]">Англи нэршил</span>
                    <input
                      value={draft.en}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, en: e.target.value }))
                      }
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="text-xs text-[var(--muted)]">Товчлол</span>
                    <input
                      value={draft.abbr}
                      onChange={(e) =>
                        setDraft((prev) => ({ ...prev, abbr: e.target.value }))
                      }
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
                    />
                  </label>
                  <label className="block space-y-1 md:col-span-2">
                    <span className="text-xs text-[var(--muted)]">Тайлбар</span>
                    <textarea
                      rows={5}
                      value={draft.definition}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          definition: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
                    />
                  </label>
                </div>
              ) : (
                <div className="grid gap-2 text-sm md:grid-cols-3">
                  <p>
                    <span className="text-[var(--muted)]">Монгол: </span>
                    {term.mn || "—"}
                  </p>
                  <p>
                    <span className="text-[var(--muted)]">Англи: </span>
                    {term.en || "—"}
                  </p>
                  <p>
                    <span className="text-[var(--muted)]">Товчлол: </span>
                    {term.abbr || "—"}
                  </p>
                  <p className="whitespace-pre-wrap md:col-span-3">
                    {term.definition || "Тайлбар оруулаагүй байна."}
                  </p>
                </div>
              )}
              {error ? <p className="text-xs text-rose-600">{error}</p> : null}
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}

export function GlossaryDictionaryClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [canEdit, setCanEdit] = useState(false);
  const [termCount, setTermCount] = useState(0);
  const [terms, setTerms] = useState<GlossaryTerm[]>([]);
  const [letters, setLetters] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [letter, setLetter] = useState("all");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [expandedTermId, setExpandedTermId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const [addDraft, setAddDraft] = useState<Draft>({
    mn: "",
    en: "",
    abbr: "",
    definition: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/glossary", { cache: "no-store" });
      const data = (await res.json()) as GlossaryPayload;
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "Толь ачаалахад алдаа");
      }
      const nextLetters = data.letters ?? [];
      setTerms(data.terms ?? []);
      setLetters(nextLetters);
      setCanEdit(Boolean(data.canEdit));
      setTermCount(data.termCount ?? 0);
      // Always start collapsed on load / page refresh.
      setOpenSections(
        Object.fromEntries(nextLetters.map((item) => [item, false])),
      );
      setExpandedTermId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Толь ачаалахад алдаа");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return terms.filter((term) => {
      if (letter !== "all") {
        const mn = term.mn.trim().charAt(0).toLocaleUpperCase("mn-MN");
        const abbr = term.abbr.trim().charAt(0).toLocaleUpperCase("mn-MN");
        if (mn !== letter && abbr !== letter) return false;
      }
      if (!q) return true;
      const haystack = [term.abbr, term.en, term.mn, term.definition]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [terms, query, letter]);

  const grouped = useMemo(() => groupByMnLetter(filtered), [filtered]);

  async function addTerm() {
    setAdding(true);
    setAddError("");
    try {
      const res = await fetch("/api/glossary/terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addDraft),
      });
      const data = (await res.json()) as {
        ok: boolean;
        term?: GlossaryTerm;
        error?: string;
      };
      if (!res.ok || !data.ok || !data.term) {
        throw new Error(data.error ?? "Нэмэхэд алдаа");
      }
      setShowAdd(false);
      setAddDraft({ mn: "", en: "", abbr: "", definition: "" });
      await load();
      const first =
        data.term.mn.trim().charAt(0).toLocaleUpperCase("mn-MN") ||
        data.term.abbr.trim().charAt(0).toLocaleUpperCase("mn-MN");
      if (first) {
        setOpenSections((prev) => ({ ...prev, [first]: true }));
      }
      setExpandedTermId(data.term.id);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Нэмэхэд алдаа");
    } finally {
      setAdding(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center text-sm text-[var(--muted)]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Толь ачаалж байна...
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Толь бичиг"
        description="Монгол үгсийг эхний үсгээр ангилсан. Анхдагч горим — хураасан; үсэг дээр дарж нээнэ."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs text-[var(--muted)]">
              <BookOpen className="h-3.5 w-3.5 text-[var(--brand)]" />
              {termCount} нэр томъёо
            </div>
            {canEdit ? (
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand)] px-3 py-1.5 text-xs text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                Шинэ үг
              </button>
            ) : null}
          </div>
        }
      />

      {error ? (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <label className="relative block flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Монгол, англи, товчлол, тайлбараар хайх..."
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] py-2 pl-9 pr-3 text-sm outline-none ring-[var(--brand)]/30 focus:ring-2"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              setOpenSections(
                Object.fromEntries(letters.map((item) => [item, true])),
              )
            }
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs"
          >
            Бүгдийг нээх
          </button>
          <button
            type="button"
            onClick={() => {
              setOpenSections(
                Object.fromEntries(letters.map((item) => [item, false])),
              );
              setExpandedTermId(null);
            }}
            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs"
          >
            Бүгдийг хураах
          </button>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setLetter("all")}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium",
            letter === "all"
              ? "bg-[var(--brand)] text-white"
              : "border border-[var(--border)] bg-[var(--card)] text-[var(--muted)]",
          )}
        >
          Бүгд
        </button>
        {letters.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setLetter(item);
              setOpenSections((prev) => ({ ...prev, [item]: true }));
            }}
            className={cn(
              "min-w-[2rem] rounded-md px-2 py-1 text-xs font-medium",
              letter === item
                ? "bg-[var(--brand)] text-white"
                : "border border-[var(--border)] bg-[var(--card)] text-[var(--muted)]",
            )}
          >
            {item}
          </button>
        ))}
      </div>

      {grouped.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] bg-[var(--card)] px-4 py-10 text-center text-sm text-[var(--muted)]">
          Хайлтад тохирох нэр томъёо олдсонгүй.
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map((group) => {
            const open = openSections[group.letter] ?? false;
            return (
              <section
                key={group.letter}
                className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--card)] shadow-sm"
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenSections((prev) => ({
                      ...prev,
                      [group.letter]: !open,
                    }))
                  }
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-[var(--bg)]/60"
                >
                  <div className="flex items-center gap-2">
                    {open ? (
                      <ChevronDown className="h-4 w-4 text-[var(--brand)]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[var(--muted)]" />
                    )}
                    <span className="text-sm font-semibold text-[var(--fg)]">
                      {group.letter}
                    </span>
                    <span className="text-xs text-[var(--muted)]">
                      {group.terms.length} үг
                    </span>
                  </div>
                </button>

                {open ? (
                  <div className="overflow-x-auto border-t border-[var(--border)]">
                    <table className="min-w-full border-collapse text-left">
                      <thead className="bg-[var(--bg)]/80 text-xs uppercase tracking-wide text-[var(--muted)]">
                        <tr>
                          <th className="w-14 px-3 py-2.5 font-semibold">№</th>
                          <th className="min-w-[160px] px-3 py-2.5 font-semibold">
                            Монгол үг
                          </th>
                          <th className="min-w-[160px] px-3 py-2.5 font-semibold">
                            Англи нэршил
                          </th>
                          <th className="w-28 px-3 py-2.5 font-semibold">
                            Товчлол
                          </th>
                          <th className="min-w-[240px] px-3 py-2.5 font-semibold">
                            Тайлбар
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.terms.map((term, index) => (
                          <TermRow
                            key={term.id}
                            no={index + 1}
                            term={term}
                            canEdit={canEdit}
                            expanded={expandedTermId === term.id}
                            onToggle={() =>
                              setExpandedTermId(
                                expandedTermId === term.id ? null : term.id,
                              )
                            }
                            onSaved={(saved) => {
                              setTerms((prev) =>
                                prev.map((row) =>
                                  row.id === saved.id ? saved : row,
                                ),
                              );
                            }}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      )}

      {showAdd ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Шинэ нэр томъёо</h2>
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="rounded-md p-1 text-[var(--muted)] hover:bg-[var(--bg)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-3">
              <label className="block space-y-1">
                <span className="text-xs text-[var(--muted)]">Монгол үг</span>
                <input
                  value={addDraft.mn}
                  onChange={(e) =>
                    setAddDraft((prev) => ({ ...prev, mn: e.target.value }))
                  }
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-[var(--muted)]">Англи нэршил</span>
                <input
                  value={addDraft.en}
                  onChange={(e) =>
                    setAddDraft((prev) => ({ ...prev, en: e.target.value }))
                  }
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-[var(--muted)]">Товчлол</span>
                <input
                  value={addDraft.abbr}
                  onChange={(e) =>
                    setAddDraft((prev) => ({ ...prev, abbr: e.target.value }))
                  }
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-[var(--muted)]">Тайлбар</span>
                <textarea
                  rows={4}
                  value={addDraft.definition}
                  onChange={(e) =>
                    setAddDraft((prev) => ({
                      ...prev,
                      definition: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30"
                />
              </label>
            </div>
            {addError ? (
              <p className="mt-3 text-xs text-rose-600">{addError}</p>
            ) : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAdd(false)}
                className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs"
              >
                Болих
              </button>
              <button
                type="button"
                disabled={adding}
                onClick={addTerm}
                className="inline-flex items-center gap-1 rounded-md bg-[var(--brand)] px-3 py-1.5 text-xs text-white disabled:opacity-60"
              >
                {adding ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                Нэмэх
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
