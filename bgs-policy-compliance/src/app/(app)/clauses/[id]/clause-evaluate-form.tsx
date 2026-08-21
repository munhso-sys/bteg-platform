"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { COMPLIANCE_STATUS_LABELS } from "@/lib/constants";
import { withBasePath } from "@/lib/paths";
import type { ComplianceStatus, ResponsibilityType } from "@/lib/types";

const STATUSES = Object.keys(COMPLIANCE_STATUS_LABELS) as ComplianceStatus[];

export function ClauseEvaluateForm({
  clauseId,
  links,
}: {
  clauseId: string;
  links: Array<{
    job_position_id: string;
    responsibility_type: ResponsibilityType;
    label: string;
  }>;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const selected = String(fd.get("link") || "");
    const [job_position_id, responsibility_type] = selected.split("::");
    try {
      const res = await fetch(withBasePath("/api/evaluations"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policy_clause_id: clauseId,
          job_position_id,
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
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хадгалж чадсангүй");
    } finally {
      setPending(false);
    }
  }

  if (!links.length) {
    return <p className="text-sm text-slate-500">Эхлээд ажлын байр онооно уу.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 text-sm">
      <select
        name="link"
        required
        className="select w-full rounded border border-slate-300 px-2 py-1.5"
      >
        {links.map((l) => (
          <option
            key={`${l.job_position_id}:${l.responsibility_type}`}
            value={`${l.job_position_id}::${l.responsibility_type}`}
          >
            {l.label}
          </option>
        ))}
      </select>
      <input
        name="evaluation_period"
        required
        defaultValue={new Date().toISOString().slice(0, 7)}
        className="w-full rounded border border-slate-300 px-2 py-1.5"
      />
      <input
        name="score"
        type="number"
        min={0}
        max={100}
        defaultValue={50}
        required
        className="w-full rounded border border-slate-300 px-2 py-1.5"
      />
      <select
        name="status"
        defaultValue="partially_compliant"
        className="w-full rounded border border-slate-300 px-2 py-1.5"
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
        className="w-full rounded border border-slate-300 px-2 py-1.5"
        placeholder="Тайлбар"
      />
      <textarea
        name="evidence_text"
        rows={2}
        className="w-full rounded border border-slate-300 px-2 py-1.5"
        placeholder="Нотлох баримт"
      />
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <button
        disabled={pending}
        className="rounded bg-orange-500 px-3 py-1.5 text-white disabled:opacity-50"
      >
        Хадгалах
      </button>
    </form>
  );
}
