"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Folder, FolderOpen, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import {
  OTHER_ALBA_ID,
  OTHER_HELTES_ID,
  type OrgAssignTree,
  type PositionListRow,
} from "@/lib/org-assign";
import { withBasePath } from "@/lib/paths";
import { cn } from "@/lib/utils";

type Props = {
  rows: PositionListRow[];
  tree: OrgAssignTree;
};

type AlbaGroup = {
  key: string;
  label: string;
  items: PositionListRow[];
};
type HeltesGroup = { key: string; label: string; albas: AlbaGroup[] };
type OrgGroup = { key: string; label: string; heltes: HeltesGroup[] };

function buildTree(rows: PositionListRow[]): OrgGroup[] {
  const orgMap = new Map<string, Map<string, Map<string, PositionListRow[]>>>();

  for (const row of rows) {
    const orgKey = row.organization_name.trim() || "__none__";
    const hKey = row.heltesId;
    const aKey = row.albaId;
    if (!orgMap.has(orgKey)) orgMap.set(orgKey, new Map());
    const hMap = orgMap.get(orgKey)!;
    if (!hMap.has(hKey)) hMap.set(hKey, new Map());
    const aMap = hMap.get(hKey)!;
    if (!aMap.has(aKey)) aMap.set(aKey, []);
    aMap.get(aKey)!.push(row);
  }

  const orgs: OrgGroup[] = [];
  for (const [orgKey, hMap] of orgMap) {
    const heltes: HeltesGroup[] = [];
    for (const [hKey, aMap] of hMap) {
      const albas: AlbaGroup[] = [];
      for (const [aKey, items] of aMap) {
        albas.push({
          key: `${orgKey}::${hKey}::${aKey}`,
          label: items[0]?.alba || aKey,
          items,
        });
      }
      albas.sort((a, b) => a.label.localeCompare(b.label, "mn"));
      heltes.push({
        key: `${orgKey}::${hKey}`,
        label: albas[0]?.items[0]?.heltes || hKey,
        albas,
      });
    }
    heltes.sort((a, b) => {
      // «Бусад» always last under each organization
      if (a.key.endsWith(`::${OTHER_HELTES_ID}`)) return 1;
      if (b.key.endsWith(`::${OTHER_HELTES_ID}`)) return -1;
      if (a.label === "Бусад") return 1;
      if (b.label === "Бусад") return -1;
      return a.label.localeCompare(b.label, "mn");
    });
    orgs.push({
      key: orgKey,
      label: orgKey === "__none__" ? "Ангилагдаагүй байгууллага" : orgKey,
      heltes,
    });
  }
  orgs.sort((a, b) => {
    if (a.key === "__none__") return 1;
    if (b.key === "__none__") return -1;
    return a.label.localeCompare(b.label, "mn");
  });
  return orgs;
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
        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100",
        depth === 0 && "bg-slate-100 font-semibold",
        depth === 1 && "bg-slate-50 font-medium text-slate-800",
        depth === 2 && "text-slate-700",
      )}
      style={{ paddingLeft: 8 + depth * 16 }}
    >
      {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      {open ? (
        <FolderOpen size={16} className="text-orange-500" />
      ) : (
        <Folder size={16} className="text-slate-400" />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="tabular-nums text-xs text-slate-500">{count}</span>
    </button>
  );
}

function resolveHeltesAlbaLabels(
  tree: OrgAssignTree,
  heltesId: string,
  albaId: string,
): { heltes: string; alba: string } {
  if (heltesId === OTHER_HELTES_ID || heltesId === tree.other.id) {
    return { heltes: tree.other.name, alba: "—" };
  }
  const heltes = tree.heltes.find((h) => h.id === heltesId);
  const alba = heltes?.albas.find((a) => a.id === albaId);
  return {
    heltes: heltes?.name ?? heltesId,
    alba: alba?.name ?? albaId,
  };
}

function PositionRow({
  row,
  index,
  tree,
  onSaved,
  onDeleted,
}: {
  row: PositionListRow;
  index: number;
  tree: OrgAssignTree;
  onSaved: (next: PositionListRow) => void;
  onDeleted: (id: string) => void;
}) {
  const [orgName, setOrgName] = useState(row.organization_name);
  const [heltesId, setHeltesId] = useState(row.heltesId);
  const [albaId, setAlbaId] = useState(row.albaId);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setOrgName(row.organization_name);
      setHeltesId(row.heltesId);
      setAlbaId(row.albaId);
    }, 0);
    return () => window.clearTimeout(id);
  }, [row.organization_name, row.heltesId, row.albaId, row.id]);

  const albaOptions = useMemo(() => {
    if (heltesId === OTHER_HELTES_ID || heltesId === tree.other.id) {
      return [{ id: OTHER_ALBA_ID, name: "—" }];
    }
    return tree.heltes.find((h) => h.id === heltesId)?.albas ?? [];
  }, [heltesId, tree]);

  async function save(next: {
    organization_name?: string | null;
    heltes_id: string;
    alba_id: string;
  }) {
    setError(null);
    try {
      const res = await fetch(withBasePath(`/api/positions/${row.id}/org`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error || `Алдаа (${res.status})`);
      }
      const labels = resolveHeltesAlbaLabels(
        tree,
        next.heltes_id,
        next.alba_id,
      );
      const updated: PositionListRow = {
        ...row,
        organization_name: (next.organization_name ?? "").trim(),
        heltesId: next.heltes_id,
        albaId: next.alba_id,
        heltes: labels.heltes,
        alba: labels.alba,
      };
      startTransition(() => onSaved(updated));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Хадгалж чадсангүй");
    }
  }

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50">
      <td className="px-2 py-1.5 pr-2 align-top tabular-nums text-xs text-slate-500">
        {index}
      </td>
      <td className="py-1.5 pr-2 align-top">
        <input
          value={orgName}
          disabled={pending}
          onChange={(e) => setOrgName(e.target.value)}
          onBlur={() => {
            if (orgName.trim() !== row.organization_name.trim()) {
              void save({
                organization_name: orgName,
                heltes_id: heltesId,
                alba_id: albaId,
              });
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          placeholder="Байгууллага…"
          className="w-full min-w-[120px] rounded border border-slate-300 px-1.5 py-1 text-xs"
        />
      </td>
      <td className="py-1.5 pr-2 align-top">
        <select
          value={heltesId}
          disabled={pending}
          onChange={(e) => {
            const nextH = e.target.value;
            setHeltesId(nextH);
            const albas =
              nextH === tree.other.id
                ? [{ id: OTHER_ALBA_ID }]
                : (tree.heltes.find((h) => h.id === nextH)?.albas ?? []);
            const nextA = albas[0]?.id ?? OTHER_ALBA_ID;
            setAlbaId(nextA);
            void save({
              organization_name: orgName,
              heltes_id: nextH,
              alba_id: nextA,
            });
          }}
          className="w-full min-w-[140px] max-w-[200px] rounded border border-slate-300 bg-white px-1.5 py-1 text-xs"
        >
          {tree.heltes.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name}
            </option>
          ))}
          <option value={tree.other.id}>{tree.other.name}</option>
        </select>
      </td>
      <td className="py-1.5 pr-2 align-top">
        <select
          value={albaId}
          disabled={pending || heltesId === tree.other.id}
          onChange={(e) => {
            const nextA = e.target.value;
            setAlbaId(nextA);
            void save({
              organization_name: orgName,
              heltes_id: heltesId,
              alba_id: nextA,
            });
          }}
          className="w-full min-w-[140px] max-w-[200px] rounded border border-slate-300 bg-white px-1.5 py-1 text-xs"
        >
          {albaOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        {error ? (
          <div className="mt-0.5 text-[10px] text-rose-600">{error}</div>
        ) : null}
      </td>
      <td className="py-1.5 pr-2 align-top">
        <Link
          href={`/positions/${row.id}?from=positions`}
          className="font-medium hover:underline"
        >
          {row.name}
        </Link>
      </td>
      <td className="py-1.5 pr-2 align-top font-mono text-xs">
        {row.bteg_id || "—"}
      </td>
      <td className="py-1.5 pr-2 align-top">
        {row.has_job_description ? (
          <Badge className="bg-emerald-100 text-emerald-800">Тийм</Badge>
        ) : (
          <Badge className="bg-amber-100 text-amber-900">Үгүй</Badge>
        )}
      </td>
      <td className="py-1.5 pr-2 align-top tabular-nums">{row.link_count}</td>
      <td className="py-1.5 pr-2 align-top text-right">
        <button
          type="button"
          disabled={pending || deleting}
          title="Устгах"
          aria-label="Устгах"
          onClick={async () => {
            if (!confirm(`“${row.name}” ажлын байрыг устгах уу?`)) return;
            setDeleting(true);
            setError(null);
            try {
              const res = await fetch(withBasePath(`/api/positions/${row.id}`), {
                method: "DELETE",
              });
              if (!res.ok) {
                const data = (await res.json().catch(() => null)) as {
                  error?: string;
                } | null;
                throw new Error(data?.error || `Алдаа (${res.status})`);
              }
              startTransition(() => onDeleted(row.id));
            } catch (err) {
              setError(err instanceof Error ? err.message : "Устгаж чадсангүй");
            } finally {
              setDeleting(false);
            }
          }}
          className="rounded border border-slate-200 p-1.5 text-slate-500 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50"
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
}

export function PositionsOrgTree({ rows: initialRows, tree }: Props) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [rowsEpoch, setRowsEpoch] = useState(initialRows);
  if (initialRows !== rowsEpoch) {
    setRowsEpoch(initialRows);
    setRows(initialRows);
  }

  const groups = useMemo(() => buildTree(rows), [rows]);
  const allKeys = useMemo(() => {
    const keys: string[] = [];
    for (const o of groups) {
      keys.push(o.key);
      for (const h of o.heltes) {
        keys.push(h.key);
        for (const a of h.albas) keys.push(a.key);
      }
    }
    return keys;
  }, [groups]);

  const [open, setOpen] = useState<Set<string>>(() => new Set());

  function toggle(key: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function openPathForRow(row: PositionListRow) {
    const orgKey = row.organization_name.trim() || "__none__";
    const heltesKey = `${orgKey}::${row.heltesId}`;
    const albaKey = `${orgKey}::${row.heltesId}::${row.albaId}`;
    setOpen((prev) => {
      const next = new Set(prev);
      next.add(orgKey);
      next.add(heltesKey);
      next.add(albaKey);
      return next;
    });
  }

  function handleSaved(updated: PositionListRow) {
    setRows((prev) =>
      prev.map((r) => (r.id === updated.id ? updated : r)),
    );
    openPathForRow(updated);
    router.refresh();
  }

  function handleDeleted(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    router.refresh();
  }

  let counter = 0;
  const flatRows: React.ReactNode[] = [];

  for (const org of groups) {
    const orgCount = org.heltes.reduce(
      (s, h) => s + h.albas.reduce((ss, a) => ss + a.items.length, 0),
      0,
    );
    const orgOpen = open.has(org.key);
    flatRows.push(
      <tr key={`org-${org.key}`}>
        <td colSpan={9} className="p-0">
          <FolderHeader
            open={orgOpen}
            onToggle={() => toggle(org.key)}
            label={org.label}
            count={orgCount}
            depth={0}
          />
        </td>
      </tr>,
    );
    if (!orgOpen) continue;

    for (const heltes of org.heltes) {
      const hCount = heltes.albas.reduce((s, a) => s + a.items.length, 0);
      const hOpen = open.has(heltes.key);
      flatRows.push(
        <tr key={`h-${heltes.key}`}>
          <td colSpan={9} className="p-0">
            <FolderHeader
              open={hOpen}
              onToggle={() => toggle(heltes.key)}
              label={heltes.label}
              count={hCount}
              depth={1}
            />
          </td>
        </tr>,
      );
      if (!hOpen) continue;

      for (const alba of heltes.albas) {
        const aOpen = open.has(alba.key);
        flatRows.push(
          <tr key={`a-${alba.key}`}>
            <td colSpan={9} className="p-0">
              <FolderHeader
                open={aOpen}
                onToggle={() => toggle(alba.key)}
                label={alba.label}
                count={alba.items.length}
                depth={2}
              />
            </td>
          </tr>,
        );
        if (!aOpen) continue;
        for (const row of alba.items) {
          counter += 1;
          flatRows.push(
            <PositionRow
              key={`${row.id}:${row.organization_name}:${row.heltesId}:${row.albaId}`}
              row={row}
              index={counter}
              tree={tree}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
            />,
          );
        }
      }
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50"
          onClick={() => setOpen(new Set(allKeys))}
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
        <span className="self-center text-slate-500">
          {rows.length} ажлын байр
        </span>
      </div>

      <div className="overflow-x-auto rounded border border-slate-200">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-2 py-1.5">#</th>
              <th className="py-1.5 pr-2">Байгууллага</th>
              <th className="py-1.5 pr-2">Хэлтэс</th>
              <th className="py-1.5 pr-2">Алба</th>
              <th className="py-1.5 pr-2">Ажлын байр</th>
              <th className="py-1.5 pr-2">BTEG</th>
              <th className="py-1.5 pr-2">Тодорхойлолт</th>
              <th className="py-1.5 pr-2">Холбоос</th>
              <th className="py-1.5 pr-2 text-right">Устгах</th>
            </tr>
          </thead>
          <tbody>{flatRows}</tbody>
        </table>
      </div>
    </div>
  );
}
