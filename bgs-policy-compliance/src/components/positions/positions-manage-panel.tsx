"use client";

import { useMemo, useState } from "react";
import {
  OTHER_ALBA_ID,
  OTHER_HELTES_ID,
  type OrgAssignTree,
  type PositionListRow,
} from "@/lib/org-assign";
import { Panel } from "@/components/ui/primitives";
import { PositionsOrgTree } from "../../app/(app)/positions/positions-org-tree";

type OrgOption = { value: string; label: string };

function filterManageRows(
  rows: PositionListRow[],
  scope: {
    organization?: string;
    heltesId?: string;
    albaId?: string;
    q?: string;
  },
): PositionListRow[] {
  let out = rows;
  if (scope.organization) {
    const org = scope.organization;
    out = out.filter((r) => {
      const key = r.organization_name.trim() || "__none__";
      return key === org;
    });
  }
  if (scope.heltesId) {
    out = out.filter((r) => r.heltesId === scope.heltesId);
  }
  if (scope.albaId) {
    out = out.filter((r) => r.albaId === scope.albaId);
  }
  if (scope.q?.trim()) {
    const s = scope.q.trim().toLowerCase();
    out = out.filter(
      (r) =>
        r.name.toLowerCase().includes(s) ||
        r.organization_name.toLowerCase().includes(s) ||
        r.heltes.toLowerCase().includes(s) ||
        r.alba.toLowerCase().includes(s) ||
        (r.official_code ?? "").toLowerCase().includes(s) ||
        (r.bteg_id ?? "").includes(s),
    );
  }
  return out;
}

/** Удирдлага: Шалгах-тай ижил шүүлтүүр + org tree. */
export function PositionsManagePanel({
  rows,
  tree,
  orgOptions,
}: {
  rows: PositionListRow[];
  tree: OrgAssignTree;
  orgOptions: OrgOption[];
}) {
  const [org, setOrg] = useState("");
  const [heltesId, setHeltesId] = useState("");
  const [albaId, setAlbaId] = useState("");
  const [q, setQ] = useState("");

  const heltesOptions = useMemo(() => {
    const source = org
      ? rows.filter((r) => (r.organization_name.trim() || "__none__") === org)
      : rows;
    const ids = new Set(source.map((r) => r.heltesId));
    const list = tree.heltes.filter((h) => ids.has(h.id));
    if (ids.has(tree.other.id) || ids.has(OTHER_HELTES_ID)) {
      list.push({ id: tree.other.id, name: tree.other.name, albas: [] });
    }
    return list;
  }, [rows, tree, org]);

  const albaOptions = useMemo(() => {
    if (!heltesId) return [] as Array<{ id: string; name: string }>;
    const source = rows.filter((r) => {
      if (r.heltesId !== heltesId) return false;
      if (org && (r.organization_name.trim() || "__none__") !== org) return false;
      return true;
    });
    const ids = new Set(source.map((r) => r.albaId));
    const heltes = tree.heltes.find((h) => h.id === heltesId);
    const albas = (heltes?.albas ?? []).filter((a) => ids.has(a.id));
    if (ids.has(OTHER_ALBA_ID)) {
      albas.push({ id: OTHER_ALBA_ID, name: "—" });
    }
    return albas;
  }, [rows, tree, org, heltesId]);

  const filtered = useMemo(
    () =>
      filterManageRows(rows, {
        organization: org || undefined,
        heltesId: heltesId || undefined,
        albaId: albaId || undefined,
        q: q.trim() || undefined,
      }),
    [rows, org, heltesId, albaId, q],
  );

  function clearFilters() {
    setOrg("");
    setHeltesId("");
    setAlbaId("");
    setQ("");
  }

  const hasFilter = Boolean(org || heltesId || albaId || q.trim());

  return (
    <div className="space-y-3">
      <Panel title="Шүүлтүүр">
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs">
            <span className="mb-0.5 block font-semibold text-[var(--muted)]">
              Байгууллага
            </span>
            <select
              value={org}
              onChange={(e) => {
                setOrg(e.target.value);
                setHeltesId("");
                setAlbaId("");
              }}
              className="min-w-[160px] rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--fg)]"
            >
              <option value="">Бүгд</option>
              {orgOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs">
            <span className="mb-0.5 block font-semibold text-[var(--muted)]">
              Хэлтэс
            </span>
            <select
              value={heltesId}
              onChange={(e) => {
                setHeltesId(e.target.value);
                setAlbaId("");
              }}
              className="min-w-[160px] rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--fg)]"
            >
              <option value="">Бүгд</option>
              {heltesOptions.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs">
            <span className="mb-0.5 block font-semibold text-[var(--muted)]">
              Алба
            </span>
            <select
              value={albaId}
              onChange={(e) => setAlbaId(e.target.value)}
              disabled={!heltesId}
              className="min-w-[160px] rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--fg)] disabled:opacity-50"
            >
              <option value="">Бүгд</option>
              {albaOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs">
            <span className="mb-0.5 block font-semibold text-[var(--muted)]">
              Хайх
            </span>
            <input
              type="text"
              name="position-manage-find"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ажлын байр, код, нэгж…"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              inputMode="text"
              data-lpignore="true"
              data-1p-ignore="true"
              data-bwignore="true"
              data-form-type="other"
              className="min-w-[200px] rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-sm text-[var(--fg)] outline-none ring-orange-500 focus:ring-2"
            />
          </label>

          {hasFilter ? (
            <button
              type="button"
              className="rounded border border-[var(--border)] px-3 py-1.5 text-sm hover:bg-[var(--surface-muted)]"
              onClick={clearFilters}
            >
              Цэвэрлэх
            </button>
          ) : null}
        </div>
      </Panel>

      <Panel title={`Ажлын байр (${filtered.length})`} className="min-w-0">
        <PositionsOrgTree rows={filtered} tree={tree} />
      </Panel>
    </div>
  );
}
