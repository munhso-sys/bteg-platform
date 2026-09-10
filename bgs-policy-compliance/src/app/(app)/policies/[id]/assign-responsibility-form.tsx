"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RESPONSIBILITY_LABELS } from "@/lib/constants";
import {
  ALBA_COMMON_LABEL,
  COMPANY_ALBA_ID,
  COMPANY_FOLDER_LABEL,
  COMPANY_HELTES_ID,
  COMPANY_SCOPE_LABEL,
  HELTES_COMMON_LABEL,
  albaScopeNote,
  companyScopeNote,
  heltesScopeNote,
  isHeltesCommonId,
  orgScopePath,
  parseHeltesCommonId,
  SCOPE_ALL_POSITIONS_ID,
  type OrgAssignTree,
} from "@/lib/org-assign";
import { withBasePath } from "@/lib/paths";
import type { ResponsibilityType } from "@/lib/types";
import { expandClauseIdsWithDescendants } from "@/lib/policy-kpis";
import {
  OrgFolderSelect,
  type OrgTreeHeltes,
  type OrgTreeLeaf,
} from "@/components/ui/org-folder-select";

const TYPES = Object.keys(RESPONSIBILITY_LABELS) as ResponsibilityType[];
const PICK_SEP = "|||";

type PositionOption = { id: string; name: string };

function encodePick(heltesId: string, albaId: string, positionId: string) {
  return `${heltesId}${PICK_SEP}${albaId}${PICK_SEP}${positionId}`;
}

function decodePick(raw: string): {
  heltesId: string;
  albaId: string;
  positionId: string;
} | null {
  const parts = raw.split(PICK_SEP);
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
  return { heltesId: parts[0], albaId: parts[1], positionId: parts[2] };
}

async function readApiError(res: Response) {
  try {
    const data = (await res.json()) as { error?: string };
    if (data?.error) return data.error;
  } catch {
    // ignore
  }
  return `Алдаа (${res.status})`;
}

export function AssignResponsibilityForm({
  clauses,
  tree,
  policyId,
  sections,
  lockedTarget,
}: {
  clauses: Array<{
    id: string;
    label: string;
    sectionId?: string | null;
    parentId?: string | null;
  }>;
  tree: OrgAssignTree;
  policyId?: string;
  sections?: Array<{ id: string; label: string }>;
  lockedTarget?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [heltesId, setHeltesId] = useState("");
  const [albaId, setAlbaId] = useState("");
  const [positionId, setPositionId] = useState("");
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [pickValue, setPickValue] = useState("");
  const [target, setTarget] = useState(lockedTarget ?? "");

  const POLICY_TARGET = "__policy__";
  const sectionTarget = (id: string) => `__section__:${id}`;

  useEffect(() => {
    if (lockedTarget) setTarget(lockedTarget);
  }, [lockedTarget]);

  const orgPickTree = useMemo((): OrgTreeHeltes[] => {
    return tree.heltes.map((h) => ({
      id: h.id,
      label: h.name,
      albas: h.albas.map((a) => ({
        id: a.id,
        label: a.name,
        leaves: isHeltesCommonId(a.id)
          ? [
              {
                id: encodePick(h.id, a.id, SCOPE_ALL_POSITIONS_ID),
                label: HELTES_COMMON_LABEL,
                meta: "нийт",
              },
            ]
          : [],
        lazy: !isHeltesCommonId(a.id),
      })),
    }));
  }, [tree.heltes]);

  const companyScopeLeaves = useMemo(
    (): OrgTreeLeaf[] => [
      {
        id: encodePick(
          COMPANY_HELTES_ID,
          COMPANY_ALBA_ID,
          SCOPE_ALL_POSITIONS_ID,
        ),
        label: COMPANY_SCOPE_LABEL,
        meta: "байгууллага",
      },
    ],
    [],
  );

  async function loadAlbaLeaves(
    heltesIdLoad: string,
    albaIdLoad: string,
  ): Promise<OrgTreeLeaf[]> {
    const qs = new URLSearchParams({
      heltesId: heltesIdLoad,
      albaId: albaIdLoad,
      tab: "positions",
    });
    const res = await fetch(withBasePath(`/api/org/alba-content?${qs}`));
    if (!res.ok) return [];
    const data = (await res.json()) as { positions?: PositionOption[] };
    const rows = Array.isArray(data.positions) ? data.positions : [];
    const sorted = [...rows].sort((a, b) =>
      a.name.localeCompare(b.name, "mn"),
    );
    return [
      {
        id: encodePick(heltesIdLoad, albaIdLoad, SCOPE_ALL_POSITIONS_ID),
        label: `${ALBA_COMMON_LABEL} (${sorted.length})`,
        meta: "нийт",
      },
      ...sorted.map((p) => ({
        id: encodePick(heltesIdLoad, albaIdLoad, p.id),
        label: p.name,
      })),
    ];
  }

  function onOrgPick(id: string) {
    setPickValue(id);
    const decoded = decodePick(id);
    if (!decoded) return;
    setHeltesId(decoded.heltesId);
    setAlbaId(decoded.albaId);
    setPositionId(decoded.positionId);
    if (decoded.positionId === SCOPE_ALL_POSITIONS_ID) {
      const qs = new URLSearchParams({
        heltesId: decoded.heltesId,
        albaId: decoded.albaId,
        tab: "positions",
      });
      fetch(withBasePath(`/api/org/alba-content?${qs}`))
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { positions?: PositionOption[] } | null) => {
          const rows = Array.isArray(data?.positions) ? data!.positions! : [];
          setPositions(
            [...rows].sort((a, b) => a.name.localeCompare(b.name, "mn")),
          );
        })
        .catch(() => setPositions([]));
    } else {
      setPositions([{ id: decoded.positionId, name: decoded.positionId }]);
    }
  }

  const targetClauseIds = useMemo(() => {
    if (!target) return [] as string[];
    if (target === POLICY_TARGET) return clauses.map((c) => c.id);
    if (target.startsWith("__section__:")) {
      const sid = target.slice("__section__:".length);
      return clauses
        .filter((c) => (c.sectionId ?? null) === sid)
        .map((c) => c.id);
    }
    return expandClauseIdsWithDescendants(target, clauses);
  }, [target, clauses]);

  const heltesName =
    heltesId === COMPANY_HELTES_ID
      ? COMPANY_FOLDER_LABEL
      : (tree.heltes.find((h) => h.id === heltesId)?.name ?? "");

  const albaName = useMemo(() => {
    if (heltesId === COMPANY_HELTES_ID) return COMPANY_SCOPE_LABEL;
    if (isHeltesCommonId(albaId)) return HELTES_COMMON_LABEL;
    return (
      tree.heltes
        .find((h) => h.id === heltesId)
        ?.albas.find((a) => a.id === albaId)?.name ?? ""
    );
  }, [heltesId, albaId, tree.heltes]);

  const organizationName = tree.organizationName ?? null;

  const scopePath = useMemo(() => {
    if (!heltesId || !albaId || !positionId) return "";
    if (heltesId === COMPANY_HELTES_ID) {
      return orgScopePath(organizationName, [
        COMPANY_FOLDER_LABEL,
        COMPANY_SCOPE_LABEL,
      ]);
    }
    if (isHeltesCommonId(albaId)) {
      return orgScopePath(organizationName, [heltesName, HELTES_COMMON_LABEL]);
    }
    if (positionId === SCOPE_ALL_POSITIONS_ID) {
      return orgScopePath(organizationName, [
        heltesName,
        albaName,
        ALBA_COMMON_LABEL,
      ]);
    }
    return orgScopePath(organizationName, [heltesName, albaName]);
  }, [
    heltesId,
    albaId,
    positionId,
    heltesName,
    albaName,
    organizationName,
  ]);

  const clauseOptions = useMemo(() => clauses.slice(0, 500), [clauses]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    setOk(null);
    const fd = new FormData(e.currentTarget);
    const responsibility_type = String(fd.get("responsibility_type") || "");
    const weight = Number(fd.get("weight") || 1);
    const required_evidence = (fd.get("required_evidence") as string) || null;

    try {
      if (!targetClauseIds.length) {
        throw new Error("Журам / хэсэг / зүйл сонгоно уу");
      }
      if (!heltesId || !albaId || !positionId) {
        throw new Error("Хэлтэс / алба / ажлын байр сонгоно уу");
      }

      const scopeNotes =
        positionId === SCOPE_ALL_POSITIONS_ID
          ? heltesId === COMPANY_HELTES_ID || albaId === COMPANY_ALBA_ID
            ? companyScopeNote()
            : isHeltesCommonId(albaId)
              ? heltesScopeNote(parseHeltesCommonId(albaId) ?? heltesId)
              : albaScopeNote(albaId)
          : null;

      const positionIds =
        positionId === SCOPE_ALL_POSITIONS_ID
          ? positions.map((p) => p.id)
          : [positionId];

      if (!positionIds.length || positionIds.some((id) => !id)) {
        throw new Error(
          positionId === SCOPE_ALL_POSITIONS_ID
            ? "Энэ хамрах хүрээнд ажлын байр олдсонгүй"
            : "Ажлын байр сонгоно уу",
        );
      }

      const items = targetClauseIds.flatMap((policy_clause_id) =>
        positionIds.map((job_position_id) => ({
          policy_clause_id,
          job_position_id,
          responsibility_type,
          weight,
          required_evidence,
          notes: scopeNotes,
        })),
      );

      const CHUNK = 200;
      let okCount = 0;
      for (let i = 0; i < items.length; i += CHUNK) {
        const chunk = items.slice(i, i + CHUNK);
        const res = await fetch(withBasePath("/api/responsibilities"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            chunk.length === 1 ? chunk[0] : { items: chunk },
          ),
        });
        if (!res.ok) throw new Error(await readApiError(res));
        const data = (await res.json().catch(() => null)) as {
          count?: number;
        } | null;
        okCount += data?.count ?? chunk.length;
      }

      const scopeLabel =
        target === POLICY_TARGET
          ? "журмын бүх зүйлд"
          : target.startsWith("__section__:")
            ? "хэсгийн зүйлүүдэд"
            : targetClauseIds.length > 1
              ? "зүйл болон дэд зүйлүүдэд"
              : "зүйлд";
      setOk(`${okCount} холбоос (${scopeLabel}) хадгаллаа.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Оноож чадсангүй");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2 text-sm">
      {lockedTarget ? (
        <p className="rounded bg-slate-50 px-2 py-1.5 text-[11px] text-slate-600">
          Хамрах хүрээ:{" "}
          {lockedTarget === POLICY_TARGET
            ? `Журмын бүх зүйл (${targetClauseIds.length})`
            : lockedTarget.startsWith("__section__:")
              ? `Хэсэг · ${
                  sections?.find(
                    (s) => s.id === lockedTarget.slice("__section__:".length),
                  )?.label ?? "—"
                } (${targetClauseIds.length} зүйл)`
              : `${
                  clauses.find((c) => c.id === lockedTarget)?.label ?? "Зүйл"
                }${
                  targetClauseIds.length > 1
                    ? ` + дэд зүйл (${targetClauseIds.length})`
                    : ""
                }`}
        </p>
      ) : (
        <select
          required
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="w-full rounded border border-slate-300 px-2 py-1.5"
        >
          <option value="">Хамрах хүрээ сонгох</option>
          {policyId ? (
            <option value={POLICY_TARGET}>
              Журмын бүх зүйл ({clauses.length})
            </option>
          ) : null}
          {(sections ?? []).map((s) => {
            const n = clauses.filter(
              (c) => (c.sectionId ?? null) === s.id,
            ).length;
            return (
              <option key={s.id} value={sectionTarget(s.id)}>
                Хэсэг: {s.label} ({n} зүйл)
              </option>
            );
          })}
          <optgroup label="Зүйлээр">
            {clauseOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </optgroup>
        </select>
      )}
      {targetClauseIds.length > 1 ? (
        <p className="text-[11px] text-slate-500">
          {targetClauseIds.length} зүйлд ижил ажлын байр холбогдоно.
        </p>
      ) : null}

      <OrgFolderSelect
        name="org_pick"
        required
        tree={orgPickTree}
        scopeLeaves={companyScopeLeaves}
        value={pickValue}
        onChange={onOrgPick}
        loadAlbaLeaves={loadAlbaLeaves}
        placeholder="Хэлтэс → алба → ажлын байр сонгох…"
      />
      <input type="hidden" name="job_position_id" value={positionId} />
      {scopePath ? (
        <p className="text-[11px] text-slate-500">{scopePath}</p>
      ) : (
        <p className="text-[11px] text-slate-500">
          Хэлтэс/алба folder нээж ажлын байр эсвэл «бүх албан тушаал» сонгоно.
        </p>
      )}

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
      {ok ? <p className="text-xs text-emerald-700">{ok}</p> : null}
      <button
        disabled={pending}
        className="rounded bg-slate-900 px-3 py-1.5 text-white disabled:opacity-50"
      >
        Оноох
      </button>
    </form>
  );
}
