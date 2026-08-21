"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DateInput } from "@/components/ui/date-input";
import { withBasePath } from "@/lib/paths";

export function CreatePolicyForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(withBasePath("/api/policies"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        reference_code: fd.get("reference_code") || null,
        approved_date: fd.get("approved_date") || null,
        status: "draft",
      }),
    });
    setPending(false);
    if (!res.ok) {
      setError("Журам үүсгэж чадсангүй");
      return;
    }
    const data = await res.json();
    router.push(`/policies/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 text-sm">
      <label className="block">
        <span className="text-xs text-slate-500">Нэр</span>
        <input
          name="name"
          required
          className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5"
        />
      </label>
      <label className="block">
        <span className="text-xs text-slate-500">Лавлах код</span>
        <input
          name="reference_code"
          className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5"
        />
      </label>
      <label className="block">
        <span className="text-xs text-slate-500">Батлагдсан огноо</span>
        <DateInput name="approved_date" className="mt-0.5" />
      </label>
      <p className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
        Шинэ журам <span className="font-medium">Ноорог</span> төлөвтэй
        үүснэ. Идэвхжүүлэхийн тулд Ноорог хүснэгтээс төлөв солих icon
        ашиглана.
      </p>
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-slate-900 px-3 py-1.5 text-white disabled:opacity-50"
      >
        {pending ? "Хадгалж байна…" : "Үүсгэх"}
      </button>
    </form>
  );
}
