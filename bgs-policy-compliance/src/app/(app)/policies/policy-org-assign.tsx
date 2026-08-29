"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  COMPANY_ALBA_ID,
  COMPANY_HELTES_ID,
  OTHER_ALBA_ID,
  type OrgAssignTree,
} from "@/lib/org-assign";
import { withBasePath } from "@/lib/paths";

export function PolicyOrgAssignControls({
  policyId,
  initialHeltesId,
  initialAlbaId,
  tree,
}: {
  policyId: string;
  initialHeltesId: string;
  initialAlbaId: string;
  tree: OrgAssignTree;
}) {
  const router = useRouter();
  const [heltesId, setHeltesId] = useState(initialHeltesId);
  const [albaId, setAlbaId] = useState(initialAlbaId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const albaOptions = useMemo(() => {
    if (heltesId === tree.other.id) {
      return [{ id: OTHER_ALBA_ID, name: "—" }];
    }
    if (heltesId === COMPANY_HELTES_ID) {
      return [{ id: COMPANY_ALBA_ID, name: "Бүх ажилчид (байгууллага)" }];
    }
    return tree.heltes.find((h) => h.id === heltesId)?.albas ?? [];
  }, [heltesId, tree]);

  async function persist(nextHeltes: string, nextAlba: string) {
    setError(null);
    try {
      const res = await fetch(withBasePath(`/api/policies/${policyId}/org`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heltes_id: nextHeltes, alba_id: nextAlba }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || `Алдаа (${res.status})`);
      }
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хадгалж чадсангүй");
    }
  }

  function onHeltesChange(next: string) {
    setHeltesId(next);
    let nextAlba = albaId;
    if (next === tree.other.id) {
      nextAlba = OTHER_ALBA_ID;
    } else if (next === COMPANY_HELTES_ID) {
      nextAlba = COMPANY_ALBA_ID;
    } else {
      const albas = tree.heltes.find((h) => h.id === next)?.albas ?? [];
      nextAlba = albas[0]?.id ?? "";
    }
    setAlbaId(nextAlba);
    if (nextAlba) void persist(next, nextAlba);
  }

  function onAlbaChange(next: string) {
    setAlbaId(next);
    void persist(heltesId, next);
  }

  return (
    <div className="flex min-w-[220px] flex-col gap-1">
      <select
        value={heltesId}
        disabled={pending}
        onChange={(e) => onHeltesChange(e.target.value)}
        className="w-full max-w-[220px] rounded border border-slate-300 bg-white px-1.5 py-1 text-xs"
        title="Хэлтэс / хамрах хүрээ"
      >
        {tree.heltes.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
        <option value={tree.other.id}>{tree.other.name}</option>
      </select>
      <select
        value={albaId}
        disabled={
          pending ||
          heltesId === tree.other.id ||
          heltesId === COMPANY_HELTES_ID
        }
        onChange={(e) => onAlbaChange(e.target.value)}
        className="w-full max-w-[220px] rounded border border-slate-300 bg-white px-1.5 py-1 text-xs"
        title="Алба / хамрах хүрээ"
      >
        {albaOptions.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      {heltesId === COMPANY_HELTES_ID ? (
        <span className="text-[10px] text-slate-500">
          Бүх хэрэглэгчид журам/хэсэг/зүйл харна
        </span>
      ) : null}
      {error ? <span className="text-[10px] text-rose-600">{error}</span> : null}
    </div>
  );
}
