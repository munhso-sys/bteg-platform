"use client";

import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Panel } from "@/components/ui/primitives";
import { POLICY_STATUS_LABELS } from "@/lib/constants";
import {
  OTHER_ALBA_ID,
  OTHER_HELTES_ID,
  type OrgAssignTree,
} from "@/lib/org-assign";
import { withBasePath } from "@/lib/paths";
import type { Policy, PolicyStatus } from "@/lib/types";
import { cn, formatDate, truncate } from "@/lib/utils";
import { PolicyEditButton, type PolicyMetaUpdate } from "./policy-edit-drawer";
import { PolicyOrgAssignControls } from "./policy-org-assign";
import { PolicyStatusMenu } from "./policy-status-menu";

type OrgAssign = {
  heltesId: string;
  albaId: string;
  heltes?: string;
  alba?: string;
};

export type PolicyTableRow = {
  policy: Policy;
  clauseCount: number;
  org: OrgAssign | null;
};

type AlbaGroup = {
  key: string;
  label: string;
  items: PolicyTableRow[];
};
type HeltesGroup = { key: string; label: string; albas: AlbaGroup[] };

const SECTIONS: Array<{
  status: PolicyStatus;
  title: string;
  description: string;
}> = [
  {
    status: "active",
    title: "Идэвхтэй журам",
    description: "Хэрэглэгдэж буй журмууд",
  },
  {
    status: "draft",
    title: "Ноорог журам",
    description: "Шинээр үүсгэсэн, идэвхжүүлээгүй журмууд",
  },
  {
    status: "archived",
    title: "Архив (идэвхгүй)",
    description: "Идэвхгүй болгосон журмууд",
  },
];

function resolveLabels(
  tree: OrgAssignTree,
  org: OrgAssign | null,
): { heltesId: string; albaId: string; heltes: string; alba: string } {
  const heltesId = org?.heltesId || OTHER_HELTES_ID;
  const albaId = org?.albaId || OTHER_ALBA_ID;
  if (heltesId === OTHER_HELTES_ID || heltesId === tree.other.id) {
    return {
      heltesId: OTHER_HELTES_ID,
      albaId: OTHER_ALBA_ID,
      heltes: tree.other.name,
      alba: "—",
    };
  }
  const heltes = tree.heltes.find((h) => h.id === heltesId);
  const alba = heltes?.albas.find((a) => a.id === albaId);
  return {
    heltesId,
    albaId,
    heltes: org?.heltes || heltes?.name || heltesId,
    alba: org?.alba || alba?.name || albaId,
  };
}

function buildOrgTree(
  rows: PolicyTableRow[],
  tree: OrgAssignTree,
): HeltesGroup[] {
  const hMap = new Map<string, Map<string, PolicyTableRow[]>>();
  const labels = new Map<string, { heltes: string; alba: string }>();

  for (const row of rows) {
    const meta = resolveLabels(tree, row.org);
    labels.set(`${meta.heltesId}::${meta.albaId}`, {
      heltes: meta.heltes,
      alba: meta.alba,
    });
    if (!hMap.has(meta.heltesId)) hMap.set(meta.heltesId, new Map());
    const aMap = hMap.get(meta.heltesId)!;
    if (!aMap.has(meta.albaId)) aMap.set(meta.albaId, []);
    aMap.get(meta.albaId)!.push(row);
  }

  const heltes: HeltesGroup[] = [];
  for (const [hKey, aMap] of hMap) {
    const albas: AlbaGroup[] = [];
    for (const [aKey, items] of aMap) {
      const lab = labels.get(`${hKey}::${aKey}`);
      albas.push({
        key: `${hKey}::${aKey}`,
        label: lab?.alba || aKey,
        items: items.sort((a, b) =>
          a.policy.name.localeCompare(b.policy.name, "mn"),
        ),
      });
    }
    albas.sort((a, b) => a.label.localeCompare(b.label, "mn"));
    const firstLab = labels.get(albas[0]?.key ?? "");
    heltes.push({
      key: hKey,
      label: firstLab?.heltes || hKey,
      albas,
    });
  }

  heltes.sort((a, b) => {
    if (a.key === OTHER_HELTES_ID) return 1;
    if (b.key === OTHER_HELTES_ID) return -1;
    return a.label.localeCompare(b.label, "mn");
  });
  return heltes;
}

function FolderHeader({
  open,
  onToggle,
  label,
  count,
  depth,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  count: number;
  depth: number;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-[var(--fg)] hover:bg-[var(--surface-muted)]",
        depth === 0 && "bg-[var(--surface-muted)] font-semibold",
        depth === 1 && "font-medium text-[var(--fg)]",
      )}
      style={{ paddingLeft: 8 + depth * 16 }}
    >
      {open ? <ChevronDown size={16} className="text-[var(--muted)]" /> : <ChevronRight size={16} className="text-[var(--muted)]" />}
      {open ? (
        <FolderOpen size={16} className="text-orange-500" />
      ) : (
        <Folder size={16} className="text-[var(--muted)]" />
      )}
      <span className="min-w-0 flex-1 truncate text-[var(--fg)]">{label}</span>
      <span className="tabular-nums text-xs text-[var(--muted)]">{count}</span>
    </button>
  );
}

function StatusSectionTable({
  sectionKey,
  rows,
  tree,
  open,
  toggle,
  pending,
  deletingId,
  onMetaSaved,
  onStatusChanged,
  onDelete,
}: {
  sectionKey: string;
  rows: PolicyTableRow[];
  tree: OrgAssignTree;
  open: Set<string>;
  toggle: (key: string) => void;
  pending: boolean;
  deletingId: string | null;
  onMetaSaved: (updated: PolicyMetaUpdate) => void;
  onStatusChanged: (policyId: string, next: PolicyStatus) => void;
  onDelete: (policy: Policy) => void;
}) {
  const groups = useMemo(() => buildOrgTree(rows, tree), [rows, tree]);

  let counter = 0;
  const body: React.ReactNode[] = [];

  for (const heltes of groups) {
    const hCount = heltes.albas.reduce((s, a) => s + a.items.length, 0);
    const hKey = `${sectionKey}::${heltes.key}`;
    const hOpen = open.has(hKey);
    body.push(
      <tr key={`h-${hKey}`}>
        <td colSpan={8} className="p-0">
          <FolderHeader
            open={hOpen}
            onToggle={() => toggle(hKey)}
            label={heltes.label}
            count={hCount}
            depth={0}
          />
        </td>
      </tr>,
    );
    if (!hOpen) continue;

    for (const alba of heltes.albas) {
      const aKey = `${sectionKey}::${alba.key}`;
      const aOpen = open.has(aKey);
      body.push(
        <tr key={`a-${aKey}`}>
          <td colSpan={8} className="p-0">
            <FolderHeader
              open={aOpen}
              onToggle={() => toggle(aKey)}
              label={alba.label}
              count={alba.items.length}
              depth={1}
            />
          </td>
        </tr>,
      );
      if (!aOpen) continue;

      for (const row of alba.items) {
        counter += 1;
        const p = row.policy;
        body.push(
          <tr
            key={p.id}
            className="border-b border-slate-100 hover:bg-slate-50"
          >
            <td className="px-2 py-1.5 pr-2 align-top tabular-nums text-xs text-slate-500">
              {counter}
            </td>
            <td className="py-1.5 pr-2 align-top">
              <Link
                href={`/policies/${p.id}?from=policies`}
                className="font-medium hover:underline"
              >
                {truncate(p.name, 80)}
              </Link>
            </td>
            <td className="py-1.5 pr-2 align-top">
              <PolicyOrgAssignControls
                policyId={p.id}
                initialHeltesId={row.org?.heltesId ?? OTHER_HELTES_ID}
                initialAlbaId={row.org?.albaId ?? OTHER_ALBA_ID}
                tree={tree}
              />
            </td>
            <td className="py-1.5 pr-2 align-top font-mono text-xs">
              {p.reference_code || "—"}
            </td>
            <td className="py-1.5 pr-2 align-top">
              {formatDate(p.approved_date)}
            </td>
            <td className="py-1.5 pr-2 align-top tabular-nums">
              {row.clauseCount}
            </td>
            <td className="py-1.5 pr-2 align-top">
              <div className="flex items-center gap-1">
                <PolicyStatusMenu
                  policyId={p.id}
                  policyName={p.name}
                  currentStatus={p.status as PolicyStatus}
                  onChanged={(next) => onStatusChanged(p.id, next)}
                />
                <PolicyEditButton
                  policyId={p.id}
                  onMetaSaved={onMetaSaved}
                />
              </div>
            </td>
            <td className="py-1.5 pr-2 align-top text-right">
              <button
                type="button"
                disabled={pending || deletingId === p.id}
                title="Устгах"
                aria-label="Устгах"
                onClick={() => onDelete(p)}
                className="rounded border border-slate-200 p-1.5 text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
              >
                <Trash2 size={14} />
              </button>
            </td>
          </tr>,
        );
      }
    }
  }

  return (
    <div className="soft-scroll max-h-[420px] overflow-auto rounded border border-slate-200">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="px-2 py-1.5 pr-2">#</th>
            <th className="py-1.5 pr-2">Нэр</th>
            <th className="py-1.5 pr-2">Хэлтэс / Алба</th>
            <th className="py-1.5 pr-2">Код</th>
            <th className="py-1.5 pr-2">Батлагдсан</th>
            <th className="py-1.5 pr-2">Зүйл</th>
            <th className="py-1.5 pr-2">Төлөв / Засвар</th>
            <th className="py-1.5 pr-2 text-right">Устгах</th>
          </tr>
        </thead>
        <tbody>{body}</tbody>
      </table>
    </div>
  );
}

export function PoliciesTable({
  initialRows,
  tree,
}: {
  initialRows: PolicyTableRow[];
  tree: OrgAssignTree;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [pending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [rowsEpoch, setRowsEpoch] = useState(initialRows);
  if (initialRows !== rowsEpoch) {
    setRowsEpoch(initialRows);
    setRows(initialRows);
  }

  const grouped = useMemo(() => {
    const map: Record<PolicyStatus, PolicyTableRow[]> = {
      active: [],
      draft: [],
      archived: [],
    };
    for (const row of rows) {
      const status = (row.policy.status || "draft") as PolicyStatus;
      (map[status] ?? map.draft).push(row);
    }
    return map;
  }, [rows]);

  const allFolderKeys = useMemo(() => {
    const keys: string[] = [];
    for (const section of SECTIONS) {
      const treeGroups = buildOrgTree(grouped[section.status], tree);
      for (const h of treeGroups) {
        keys.push(`${section.status}::${h.key}`);
        for (const a of h.albas) keys.push(`${section.status}::${a.key}`);
      }
    }
    return keys;
  }, [grouped, tree]);

  function toggle(key: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleMetaSaved(updated: PolicyMetaUpdate) {
    setRows((prev) =>
      prev.map((row) =>
        row.policy.id === updated.id
          ? {
              ...row,
              policy: {
                ...row.policy,
                name: updated.name,
                reference_code: updated.reference_code,
                approved_date: updated.approved_date,
                status: updated.status as Policy["status"],
              },
            }
          : row,
      ),
    );
  }

  function handleStatusChanged(policyId: string, next: PolicyStatus) {
    setRows((prev) =>
      prev.map((row) =>
        row.policy.id === policyId
          ? { ...row, policy: { ...row.policy, status: next } }
          : row,
      ),
    );
    startTransition(() => router.refresh());
  }

  async function handleDelete(policy: Policy) {
    if (!confirm(`“${policy.name}” журмыг устгах уу?`)) return;
    setDeletingId(policy.id);
    setError(null);
    try {
      const res = await fetch(withBasePath(`/api/policies/${policy.id}`), {
        method: "DELETE",
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(data?.error || `Алдаа (${res.status})`);
      }
      setRows((prev) => prev.filter((r) => r.policy.id !== policy.id));
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Устгаж чадсангүй");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <p className="text-xs text-rose-700">{error}</p> : null}

      <div className="flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50"
          onClick={() => setOpen(new Set(allFolderKeys))}
        >
          Бүгдийг нээх
        </button>
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50"
          onClick={() => setOpen(new Set())}
        >
          Бүгдийг хураах
        </button>
      </div>

      {SECTIONS.map((section) => {
        const sectionRows = grouped[section.status];
        return (
          <Panel
            key={section.status}
            title={`${section.title} (${sectionRows.length})`}
          >
            <p className="-mt-1 mb-2 text-xs text-slate-500">
              {section.description}
            </p>
            {sectionRows.length === 0 ? (
              <p className="py-3 text-sm text-slate-400">Хоосон</p>
            ) : (
              <StatusSectionTable
                sectionKey={section.status}
                rows={sectionRows}
                tree={tree}
                open={open}
                toggle={toggle}
                pending={pending}
                deletingId={deletingId}
                onMetaSaved={handleMetaSaved}
                onStatusChanged={handleStatusChanged}
                onDelete={(p) => void handleDelete(p)}
              />
            )}
          </Panel>
        );
      })}

      <p className="text-xs text-slate-500">
        Нийт {rows.length} журам · {POLICY_STATUS_LABELS.active}{" "}
        {grouped.active.length} · {POLICY_STATUS_LABELS.draft}{" "}
        {grouped.draft.length} · {POLICY_STATUS_LABELS.archived}{" "}
        {grouped.archived.length}
      </p>
    </div>
  );
}
