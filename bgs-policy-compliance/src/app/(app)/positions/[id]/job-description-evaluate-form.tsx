"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { withBasePath } from "@/lib/paths";
import type { JobDescriptionEvaluation } from "@/lib/types";

const inputClass =
  "w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm";
const areaClass =
  "w-full rounded border border-slate-300 bg-white px-2 py-1.5 text-sm leading-relaxed";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

export function JobDescriptionEvaluateForm({
  positionId,
  initial,
}: {
  positionId: string;
  initial: JobDescriptionEvaluation | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setMsg(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch(
        withBasePath("/api/job-description-evaluations"),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            job_position_id: positionId,
            evaluation_period: String(fd.get("evaluation_period") ?? "").trim(),
            score: Number(fd.get("score")),
            result_text: String(fd.get("result_text") ?? "").trim() || null,
            improvement_actions:
              String(fd.get("improvement_actions") ?? "").trim() || null,
            conclusion: String(fd.get("conclusion") ?? "").trim() || null,
          }),
        },
      );
      const data = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
      } | null;
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || `Алдаа (${res.status})`);
      }
      setMsg("Т-үнэлгээ хадгаллаа");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хадгалж чадсангүй");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 text-sm">
      <p className="text-xs text-slate-500">
        Ажлын байрны тодорхойлолтын үнэлгээ (Т-үнэлгээ). Журмын заалтын
        үнэлгээнд нөлөөлөхгүй.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Үнэлгээний үе">
          <input
            name="evaluation_period"
            required
            defaultValue={
              initial?.evaluation_period ??
              new Date().toISOString().slice(0, 7)
            }
            placeholder="2026-09"
            className={inputClass}
          />
        </Field>
        <Field label="Оноо (0–100)">
          <input
            name="score"
            type="number"
            min={0}
            max={100}
            required
            defaultValue={initial?.score ?? 75}
            className={inputClass}
          />
        </Field>
      </div>
      <Field label="Үр дүн">
        <textarea
          name="result_text"
          rows={3}
          defaultValue={initial?.result_text ?? ""}
          placeholder="Тодорхойлолтын үнэлгээний үр дүн…"
          className={areaClass}
        />
      </Field>
      <Field label="Сайжруулах арга хэмжээ">
        <textarea
          name="improvement_actions"
          rows={3}
          defaultValue={initial?.improvement_actions ?? ""}
          placeholder="Засах / нөхөх шаардлагатай зүйлс…"
          className={areaClass}
        />
      </Field>
      <Field label="Ерөнхий дүгнэлт">
        <textarea
          name="conclusion"
          rows={3}
          defaultValue={initial?.conclusion ?? ""}
          placeholder="Ерөнхий дүгнэлт…"
          className={areaClass}
        />
      </Field>

      {error ? <p className="text-xs text-rose-700">{error}</p> : null}
      {msg ? <p className="text-xs text-emerald-700">{msg}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded bg-[var(--brand)] px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Хадгалж байна…" : "Т-үнэлгээ хадгалах"}
      </button>
    </form>
  );
}
