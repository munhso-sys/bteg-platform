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
      <label className="block space-y-1">
        <span className="field-label text-xs">Хэсэг</span>
        <select name="section_id" className="select">
          <option value="">Хэсэггүй</option>
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block space-y-1">
        <span className="field-label text-xs">Эх зүйлийн ID</span>
        <input
          name="parent_id"
          placeholder="заавал биш"
          className="input font-mono text-xs"
        />
      </label>
      <label className="block space-y-1">
        <span className="field-label text-xs">Дугаар</span>
        <input name="reference_number" placeholder="1.1.1" className="input" />
      </label>
      <label className="block space-y-1">
        <span className="field-label text-xs">Зүйлийн текст</span>
        <textarea
          name="text"
          required
          rows={3}
          placeholder="Зүйлийн агуулга"
          className="textarea"
        />
      </label>
      {error ? <p className="text-xs text-rose-600 dark:text-rose-300">{error}</p> : null}
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Нэмэж байна…" : "Зүйл нэмэх"}
      </button>
    </form>
  );
}
