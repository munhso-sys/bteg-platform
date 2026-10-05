"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { COMPLIANCE_STATUS_LABELS } from "@/lib/constants";
import { withBasePath } from "@/lib/paths";
import type { ComplianceStatus, ResponsibilityType } from "@/lib/types";

const STATUSES = Object.keys(COMPLIANCE_STATUS_LABELS) as ComplianceStatus[];

export function QuickEvaluateForm({
  positionId,
  obligations,
}: {
  positionId: string;
  obligations: Array<{
    clause_id: string;
    type: ResponsibilityType;
    label: string;
  }>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const uniqueObligations = useMemo(() => {
    const seen = new Set<string>();
    const out: typeof obligations = [];
    for (const o of obligations) {
      const key = `${o.clause_id}::${o.type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(o);
    }
    return out;
  }, [obligations]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setOk(false);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const selected = String(fd.get("obligation") || "");
    const [clause_id, responsibility_type] = selected.split("::");
    try {
      const res = await fetch(withBasePath("/api/evaluations"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policy_clause_id: clause_id,
          job_position_id: positionId,
          responsibility_type,
          evaluation_period: fd.get("evaluation_period"),
          score: Number(fd.get("score")),
          status: fd.get("status"),
          comment: fd.get("comment") || null,
          evidence_text: fd.get("evidence_text") || null,
        }),
      });
      if (!res.ok) {
        let message = `Алдаа (${res.status})`;
        try {
          const data = (await res.json()) as { error?: string };
          if (data?.error) message = data.error;
        } catch {
          // ignore
        }
        throw new Error(message);
      }
      setOk(true);
      form.reset();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хадгалж чадсангүй");
    } finally {
      setPending(false);
    }
  }

  if (!uniqueObligations.length) {
    return <p className="text-sm text-slate-500">Үнэлэх үүрэг байхгүй.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 text-sm">
      <select
        name="obligation"
        required
        className="w-full rounded border border-slate-300 px-2 py-1.5"
      >
        {uniqueObligations.map((o) => (
          <option
            key={`${o.clause_id}::${o.type}`}
            value={`${o.clause_id}::${o.type}`}
          >
            {o.label}
          </option>
        ))}
      </select>
      <input
        name="evaluation_period"
        required
        defaultValue={new Date().toISOString().slice(0, 7)}
        placeholder="2026-08 эсвэл Q3-2026"
        className="w-full rounded border border-slate-300 px-2 py-1.5"
      />
      <input
        name="score"
        type="number"
        min={0}
        max={100}
        required
        defaultValue={75}
        className="w-full rounded border border-slate-300 px-2 py-1.5"
      />
      <select
        name="status"
        className="w-full rounded border border-slate-300 px-2 py-1.5"
        defaultValue="in_progress"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {COMPLIANCE_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <textarea
        name="comment"
        rows={2}
        placeholder="Тайлбар"
        className="w-full rounded border border-slate-300 px-2 py-1.5"
      />
      <textarea
        name="evidence_text"
        rows={2}
        placeholder="Нотлох баримт"
        className="w-full rounded border border-slate-300 px-2 py-1.5"
      />
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      {ok ? <p className="text-xs text-emerald-700">Хадгаллаа.</p> : null}
      <button
        disabled={pending}
        className="rounded bg-orange-500 px-3 py-1.5 text-white disabled:opacity-50"
      >
        Үнэлгээ хадгалах
      </button>
    </form>
  );
}
