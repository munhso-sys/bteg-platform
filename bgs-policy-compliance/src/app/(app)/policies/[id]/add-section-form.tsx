"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { withBasePath } from "@/lib/paths";

export function AddSectionForm({ policyId }: { policyId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      const res = await fetch(
        withBasePath(`/api/policies/${policyId}/sections`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: String(fd.get("text") || "").trim() || null,
            reference_number:
              String(fd.get("reference_number") || "").trim() || null,
          }),
        },
      );
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(data?.error || `Алдаа (${res.status})`);
      }
      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хэсэг нэмж чадсангүй");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 text-sm">
      <label className="block space-y-1">
        <span className="field-label text-xs">Дугаар</span>
        <input
          name="reference_number"
          placeholder="Жишээ: 1"
          className="input"
        />
      </label>
      <label className="block space-y-1">
        <span className="field-label text-xs">Хэсгийн гарчиг</span>
        <input
          name="text"
          placeholder="Хэсгийн нэр"
          required
          className="input"
        />
      </label>
      {error ? <p className="text-xs text-rose-600 dark:text-rose-300">{error}</p> : null}
      <button type="submit" disabled={pending} className="btn btn-primary">
        {pending ? "Нэмэж байна…" : "Хэсэг нэмэх"}
      </button>
    </form>
  );
}
