"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { COMPLIANCE_STATUS_LABELS, RESPONSIBILITY_LABELS } from "@/lib/constants";
import { withBasePath } from "@/lib/paths";
import type { ComplianceStatus, ResponsibilityType } from "@/lib/types";

const STATUSES = Object.keys(COMPLIANCE_STATUS_LABELS) as ComplianceStatus[];
const EVAL_CHUNK = 80;

export type PolicyEvalOption = {
  id: string;
  label: string;
  group: string;
  policy_clause_ids: string[];
  job_position_ids: string[];
  responsibility_type: ResponsibilityType;
};

export function PolicyEvaluateForm({
  options,
}: {
  options: PolicyEvalOption[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, PolicyEvalOption[]>();
    for (const o of options) {
      const g = o.group?.trim() || "Бусад";
      const list = map.get(g) ?? [];
      list.push(o);
      map.set(g, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "mn"));
  }, [options]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setOkMsg(null);
    const fd = new FormData(e.currentTarget);
    const selected = String(fd.get("target") || "");
    const option = options.find((o) => o.id === selected);
    if (
      !option ||
      !option.policy_clause_ids.length ||
      !option.job_position_ids.length
    ) {
      setError("Сонголт олдсонгүй");
      setPending(false);
      return;
    }

    const baseBody = {
      policy_clause_ids: option.policy_clause_ids,
      responsibility_type: option.responsibility_type,
      evaluation_period: fd.get("evaluation_period"),
      score: Number(fd.get("score")),
      status: fd.get("status"),
      comment: fd.get("comment") || null,
      evidence_text: fd.get("evidence_text") || null,
    };
    const ids = option.job_position_ids;
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += EVAL_CHUNK) {
      chunks.push(ids.slice(i, i + EVAL_CHUNK));
    }

    try {
      let saved = 0;
      for (let i = 0; i < chunks.length; i++) {
        if (chunks.length > 1) {
          setOkMsg(`Хадгалж байна… ${saved} оноо`);
        }
        const res = await fetch(withBasePath("/api/evaluations"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...baseBody,
            job_position_ids: chunks[i],
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
          if (saved > 0) {
            message = `${saved} оноо хадгалсны дараа: ${message}`;
          }
          throw new Error(message);
        }
        const data = (await res.json().catch(() => null)) as {
          count?: number;
        } | null;
        saved += data?.count ?? 0;
      }
      setOkMsg(`${saved} холбоост оноо хадгаллаа.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хадгалж чадсангүй");
    } finally {
      setPending(false);
    }
  }

  if (!options.length) {
    return (
      <p className="text-sm text-slate-500">
        Эхлээд журам/хэсэг/зүйлд ажлын байр холбоно уу.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 text-sm">
      <select
        name="target"
        required
        className="select w-full rounded border border-slate-300 px-2 py-1.5"
      >
        {grouped.map(([group, items]) => (
          <optgroup key={group} label={group}>
            {items.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <p className="text-[11px] text-slate-500">
        Журам/хэсгийн нийт сонголт нь холбогдсон бүх зүйлд оноог автоматаар
        онооно. Дараа нь зүйл бүрээр засаж болно.
      </p>
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
      {okMsg ? <p className="text-xs text-emerald-700">{okMsg}</p> : null}
      <button
        disabled={pending}
        className="rounded bg-orange-500 px-3 py-1.5 text-white disabled:opacity-50"
      >
        {pending ? "Хадгалж байна…" : "Хадгалах"}
      </button>
    </form>
  );
}

export { RESPONSIBILITY_LABELS };
