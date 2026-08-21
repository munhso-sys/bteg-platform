"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { COMPLIANCE_STATUS_LABELS, RESPONSIBILITY_LABELS } from "@/lib/constants";
import { withBasePath } from "@/lib/paths";
import type { ComplianceStatus, ResponsibilityType } from "@/lib/types";

const STATUSES = Object.keys(COMPLIANCE_STATUS_LABELS) as ComplianceStatus[];

export function NewEvaluationForm({
  policies,
  positions,
  clauses,
}: {
  policies: Array<{ id: string; name: string }>;
  positions: Array<{ id: string; name: string }>;
  clauses: Array<{ id: string; policy_id: string; label: string }>;
}) {
  const router = useRouter();
  const [policyId, setPolicyId] = useState(policies[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const filteredClauses = useMemo(
    () => clauses.filter((c) => c.policy_id === policyId).slice(0, 300),
    [clauses, policyId],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch(withBasePath("/api/evaluations"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        policy_clause_id: fd.get("policy_clause_id"),
        job_position_id: fd.get("job_position_id"),
        responsibility_type: fd.get("responsibility_type"),
        evaluation_period: fd.get("evaluation_period"),
        score: Number(fd.get("score")),
        status: fd.get("status"),
        comment: fd.get("comment") || null,
        evidence_text: fd.get("evidence_text") || null,
      }),
    });
    setPending(false);
    if (res.ok) {
      router.push("/evaluations");
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 text-sm">
      <label className="block">
        <span className="text-xs text-slate-500">Журам</span>
        <select
          value={policyId}
          onChange={(e) => setPolicyId(e.target.value)}
          className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5"
        >
          {policies.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-xs text-slate-500">Зүйл</span>
        <select
          name="policy_clause_id"
          required
          className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5"
        >
          {filteredClauses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-xs text-slate-500">Ажлын байр</span>
        <select
          name="job_position_id"
          required
          className="mt-0.5 w-full rounded border border-slate-300 px-2 py-1.5"
        >
          {positions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <select
        name="responsibility_type"
        required
        className="w-full rounded border border-slate-300 px-2 py-1.5"
      >
        {(Object.keys(RESPONSIBILITY_LABELS) as ResponsibilityType[]).map((t) => (
          <option key={t} value={t}>
            {RESPONSIBILITY_LABELS[t]}
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
        defaultValue={75}
        required
        className="w-full rounded border border-slate-300 px-2 py-1.5"
      />
      <select name="status" defaultValue="in_progress" className="w-full rounded border border-slate-300 px-2 py-1.5">
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {COMPLIANCE_STATUS_LABELS[s]}
          </option>
        ))}
      </select>
      <textarea name="comment" rows={2} placeholder="Тайлбар" className="w-full rounded border border-slate-300 px-2 py-1.5" />
      <textarea name="evidence_text" rows={2} placeholder="Нотлох баримт" className="w-full rounded border border-slate-300 px-2 py-1.5" />
      <button disabled={pending} className="rounded bg-slate-900 px-3 py-1.5 text-white disabled:opacity-50">
        Хадгалах
      </button>
    </form>
  );
}
