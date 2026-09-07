"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RESPONSIBILITY_LABELS } from "@/lib/constants";
import {
  OTHER_ALBA_ID,
  OTHER_HELTES_ID,
  type OrgAssignTree,
} from "@/lib/org-assign";
import { withBasePath } from "@/lib/paths";
import type { ResponsibilityType } from "@/lib/types";

const TYPES = Object.keys(RESPONSIBILITY_LABELS) as ResponsibilityType[];

type PositionOption = { id: string; name: string };

async function readApiError(res: Response) {
  try {
    const data = (await res.json()) as { error?: string };
    if (data?.error) return data.error;
  } catch {
    // ignore
  }
  return `Алдаа (${res.status})`;
}

function albasForHeltes(tree: OrgAssignTree, heltesId: string) {
  if (!heltesId) return [] as Array<{ id: string; name: string }>;
  if (heltesId === tree.other.id || heltesId === OTHER_HELTES_ID) {
    return [{ id: OTHER_ALBA_ID, name: "—" }];
  }
  return tree.heltes.find((h) => h.id === heltesId)?.albas ?? [];
}

export function AssignResponsibilityForm({
  clauses,
  tree,
}: {
  clauses: Array<{ id: string; label: string }>;
  tree: OrgAssignTree;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [q, setQ] = useState("");
  const [heltesId, setHeltesId] = useState("");
  const [albaId, setAlbaId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(false);

  const albaOptions = useMemo(
    () => albasForHeltes(tree, heltesId),
    [heltesId, tree],
  );

  // Keep select value consistent without syncing via useEffect (eslint react-hooks).
  const selectedAlbaId =
    albaOptions.length === 0
      ? ""
      : albaOptions.length === 1
        ? albaOptions[0].id
        : albaOptions.some((a) => a.id === albaId)
          ? albaId
          : "";

  const activeAlbaId = selectedAlbaId;

  useEffect(() => {
    if (!heltesId || !activeAlbaId) {
      return;
    }

    let cancelled = false;
    const qs = new URLSearchParams({
      heltesId,
      albaId: activeAlbaId,
      tab: "positions",
    });

    void (async () => {
      setLoadingPositions(true);
      setPositions([]);
      setPositionId("");
      try {
        const res = await fetch(withBasePath(`/api/org/alba-content?${qs}`));
        if (!res.ok) throw new Error(await readApiError(res));
        const data = (await res.json()) as {
          ok?: boolean;
          positions?: PositionOption[];
        };
        if (cancelled) return;
        const rows = Array.isArray(data.positions) ? data.positions : [];
        setPositions(
          [...rows].sort((a, b) => a.name.localeCompare(b.name, "mn")),
        );
      } catch {
        if (!cancelled) setPositions([]);
      } finally {
        if (!cancelled) setLoadingPositions(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [heltesId, activeAlbaId]);

  const filteredPositions = useMemo(() => {
    if (!heltesId || !activeAlbaId) return [];
    const s = q.trim().toLowerCase();
    if (!s) return positions;
    return positions.filter((p) => p.name.toLowerCase().includes(s));
  }, [positions, q, heltesId, activeAlbaId]);

  const selectedPositionId = filteredPositions.some((p) => p.id === positionId)
    ? positionId
    : "";

  const clauseOptions = useMemo(() => clauses.slice(0, 500), [clauses]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setOk(false);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch(withBasePath("/api/responsibilities"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          policy_clause_id: fd.get("policy_clause_id"),
          job_position_id: selectedPositionId || fd.get("job_position_id"),
          responsibility_type: fd.get("responsibility_type"),
          weight: Number(fd.get("weight") || 1),
          required_evidence: fd.get("required_evidence") || null,
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res));
      setOk(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Оноож чадсангүй");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 text-sm">
      <select
        name="policy_clause_id"
        required
        className="w-full rounded border border-slate-300 px-2 py-1.5"
      >
        <option value="">Зүйл сонгох</option>
        {clauseOptions.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      <select
        value={heltesId}
        onChange={(e) => {
          const next = e.target.value;
          setHeltesId(next);
          const nextAlbas = albasForHeltes(tree, next);
          setAlbaId(nextAlbas.length === 1 ? nextAlbas[0].id : "");
          setPositionId("");
          setPositions([]);
        }}
        className="w-full rounded border border-slate-300 bg-white px-2 py-1.5"
      >
        <option value="">Хэлтэс сонгох</option>
        {tree.heltes.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name}
          </option>
        ))}
        <option value={tree.other.id}>{tree.other.name}</option>
      </select>
      <select
        value={activeAlbaId}
        disabled={!heltesId}
        onChange={(e) => {
          setAlbaId(e.target.value);
          setPositionId("");
          setPositions([]);
        }}
        className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 disabled:bg-slate-50"
      >
        <option value="">Алба сонгох</option>
        {albaOptions.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        disabled={!activeAlbaId}
        placeholder="Ажлын байр хайх…"
        className="w-full rounded border border-slate-300 px-2 py-1.5 disabled:bg-slate-50"
      />
      <select
        name="job_position_id"
        required
        value={selectedPositionId}
        disabled={!activeAlbaId || loadingPositions}
        onChange={(e) => setPositionId(e.target.value)}
        className="w-full rounded border border-slate-300 px-2 py-1.5 disabled:bg-slate-50"
      >
        <option value="">
          {loadingPositions
            ? "Ачаалж байна…"
            : !activeAlbaId
              ? "Эхлээд алба сонгоно уу"
              : "Ажлын байр сонгох"}
        </option>
        {filteredPositions.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select
        name="responsibility_type"
        required
        className="w-full rounded border border-slate-300 px-2 py-1.5"
      >
        {TYPES.map((t) => (
          <option key={t} value={t}>
            {RESPONSIBILITY_LABELS[t]}
          </option>
        ))}
      </select>
      <input
        name="weight"
        type="number"
        step="0.1"
        defaultValue={1}
        className="w-full rounded border border-slate-300 px-2 py-1.5"
      />
      <input
        name="required_evidence"
        placeholder="Шаардлагатай нотлох баримт"
        className="w-full rounded border border-slate-300 px-2 py-1.5"
      />
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      {ok ? <p className="text-xs text-emerald-700">Хадгаллаа.</p> : null}
      <button
        disabled={pending}
        className="rounded bg-slate-900 px-3 py-1.5 text-white disabled:opacity-50"
      >
        Оноох
      </button>
    </form>
  );
}
