"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { COMPLIANCE_STATUS_LABELS, RESPONSIBILITY_SHORT } from "@/lib/constants";
import { SCOPE_EVAL_PREFIX } from "@/lib/org-assign";
import { withBasePath } from "@/lib/paths";
import type { ComplianceStatus, ResponsibilityType } from "@/lib/types";
import {
  OrgFolderSelect,
  type OrgTreeHeltes,
  type OrgTreeLeaf,
} from "@/components/ui/org-folder-select";

const STATUSES = Object.keys(COMPLIANCE_STATUS_LABELS) as ComplianceStatus[];
const EVAL_CHUNK = 80;

export type EvaluateLinkOption = {
  id: string;
  job_position_ids: string[];
  responsibility_type: ResponsibilityType;
  label: string;
  group: string;
  isScope?: boolean;
  heltesName?: string;
  albaName?: string;
  positionName?: string;
};

function buildOrgTreeFromLinks(links: EvaluateLinkOption[]): {
  tree: OrgTreeHeltes[];
  scopeLeaves: OrgTreeLeaf[];
} {
  const scopeLeaves: OrgTreeLeaf[] = [];
  const hMap = new Map<
    string,
    { label: string; albas: Map<string, { label: string; leaves: OrgTreeLeaf[] }> }
  >();

  for (const l of links) {
    if (l.isScope) {
      scopeLeaves.push({
        id: l.id,
        label: l.label,
      });
      continue;
    }
    const heltes = (l.heltesName || l.group || "Ангилагдаагүй").trim();
    const alba = (l.albaName || "—").trim();
    if (!hMap.has(heltes)) {
      hMap.set(heltes, { label: heltes, albas: new Map() });
    }
    const h = hMap.get(heltes)!;
    if (!h.albas.has(alba)) {
      h.albas.set(alba, { label: alba, leaves: [] });
    }
    h.albas.get(alba)!.leaves.push({
      id: l.id,
      label: l.positionName || l.label,
      meta: RESPONSIBILITY_SHORT[l.responsibility_type],
    });
  }

  const tree: OrgTreeHeltes[] = [...hMap.entries()]
    .map(([id, h]) => ({
      id,
      label: h.label,
      albas: [...h.albas.entries()]
        .map(([aid, a]) => ({
          id: aid,
          label: a.label,
          leaves: a.leaves.sort((x, y) =>
            x.label.localeCompare(y.label, "mn"),
          ),
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "mn")),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "mn"));

  return { tree, scopeLeaves };
}

export function ClauseEvaluateForm({
  clauseId,
  links,
}: {
  clauseId: string;
  links: EvaluateLinkOption[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState(() => links[0]?.id ?? "");

  const { tree, scopeLeaves } = useMemo(
    () => buildOrgTreeFromLinks(links),
    [links],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setOkMsg(null);
    const fd = new FormData(e.currentTarget);
    const option = links.find((l) => l.id === selected);
    if (!option || !option.job_position_ids.length) {
      setError("Сонголт олдсонгүй");
      setPending(false);
      return;
    }

    const baseBody = {
      policy_clause_id: clauseId,
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
          setOkMsg(`Хадгалж байна… ${saved}/${ids.length}`);
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
            message = `${saved}/${ids.length} хадгалсны дараа: ${message}`;
          }
          throw new Error(message);
        }
        const data = (await res.json().catch(() => null)) as {
          count?: number;
        } | null;
        saved += data?.count ?? chunks[i].length;
      }
      setOkMsg(
        option.isScope || ids.length > 1
          ? `${saved} ажлын байранд оноо хадгаллаа.`
          : "Хадгаллаа.",
      );
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
      <OrgFolderSelect
        name="link"
        required
        tree={tree}
        scopeLeaves={scopeLeaves}
        value={selected}
        onChange={setSelected}
        placeholder="Хэлтэс / алба / ажлын байр сонгох…"
      />
      <p className="text-[11px] text-slate-500">
        Хэлтэс → алба folder нээж ажлын байр сонгоно. «Бүх албан тушаал»
        сонговол оноо бүгдэд автоматаар орно.
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

export { SCOPE_EVAL_PREFIX };
