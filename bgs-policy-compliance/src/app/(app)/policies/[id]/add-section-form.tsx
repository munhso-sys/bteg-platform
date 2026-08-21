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
      <input
        name="reference_number"
        placeholder="Дугаар"
        className="w-full rounded border border-slate-300 px-2 py-1.5"
      />
      <input
        name="text"
        placeholder="Хэсгийн гарчиг"
        required
        className="w-full rounded border border-slate-300 px-2 py-1.5"
      />
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-slate-900 px-3 py-1.5 text-white disabled:opacity-50"
      >
        {pending ? "Нэмэж байна…" : "Хэсэг нэмэх"}
      </button>
    </form>
  );
}
