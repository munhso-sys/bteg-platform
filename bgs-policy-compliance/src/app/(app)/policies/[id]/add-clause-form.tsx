"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { withBasePath } from "@/lib/paths";

export function AddClauseForm({
  policyId,
  sections,
}: {
  policyId: string;
  sections: Array<{ id: string; label: string }>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const text = String(fd.get("text") ?? "").trim();
    if (!text) {
      setError("Зүйлийн текст оруулна уу");
      setPending(false);
      return;
    }
    try {
      const res = await fetch(withBasePath(`/api/policies/${policyId}/clauses`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section_id: String(fd.get("section_id") || "") || null,
          parent_id: String(fd.get("parent_id") || "").trim() || null,
          reference_number:
            String(fd.get("reference_number") || "").trim() || null,
          text,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        id?: string;
      } | null;
      if (!res.ok) {
        throw new Error(data?.error || `Алдаа (${res.status})`);
      }
      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Зүйл нэмж чадсангүй");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 text-sm">
      <select
        name="section_id"
        className="w-full rounded border border-slate-300 px-2 py-1.5"
      >
        <option value="">Хэсэггүй</option>
        {sections.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <input
        name="parent_id"
        placeholder="Эх зүйлийн id (заавал биш)"
        className="w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-xs"
      />
      <input
        name="reference_number"
        placeholder="1.1.1"
        className="w-full rounded border border-slate-300 px-2 py-1.5"
      />
      <textarea
        name="text"
        required
        rows={3}
        placeholder="Зүйлийн текст"
        className="w-full rounded border border-slate-300 px-2 py-1.5"
      />
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-slate-900 px-3 py-1.5 text-white disabled:opacity-50"
      >
        {pending ? "Нэмэж байна…" : "Зүйл нэмэх"}
      </button>
    </form>
  );
}
