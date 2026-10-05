"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
} from "lucide-react";
import { Badge, ScoreChip } from "@/components/ui/primitives";
import type { PositionReviewRow } from "@/lib/org-assign";
import { cn } from "@/lib/utils";

type AlbaGroup = {
  key: string;
  label: string;
  items: PositionReviewRow[];
};
type HeltesGroup = { key: string; label: string; albas: AlbaGroup[] };
type OrgGroup = { key: string; label: string; heltes: HeltesGroup[] };

function buildTree(rows: PositionReviewRow[]): OrgGroup[] {
  const orgMap = new Map<string, Map<string, Map<string, PositionReviewRow[]>>>();

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
          items: items.sort((a, b) => a.name.localeCompare(b.name, "mn")),
        });
      }
      albas.sort((a, b) => a.label.localeCompare(b.label, "mn"));
      heltes.push({
        key: `${orgKey}::${hKey}`,
        label: albas[0]?.items[0]?.heltes || hKey,
        albas,
      });
    }
    heltes.sort((a, b) => a.label.localeCompare(b.label, "mn"));
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
        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-[var(--surface-muted)]",
        depth === 0 && "bg-[var(--surface-muted)] font-semibold",
        depth === 1 && "font-medium",
      )}
      style={{ paddingLeft: 8 + depth * 16 }}
    >
      {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      {open ? (
        <FolderOpen size={16} className="text-orange-500" />
      ) : (
        <Folder size={16} className="text-[var(--muted)]" />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="tabular-nums text-xs text-[var(--muted)]">{count}</span>
    </button>
  );
}

export function PositionsReviewTable({ rows }: { rows: PositionReviewRow[] }) {
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

  let counter = 0;
  const body: React.ReactNode[] = [];
  const colSpan = 8;

  for (const org of groups) {
    const orgCount = org.heltes.reduce(
      (s, h) => s + h.albas.reduce((ss, a) => ss + a.items.length, 0),
      0,
    );
    const orgOpen = open.has(org.key);
    body.push(
      <tr key={`org-${org.key}`}>
        <td colSpan={colSpan} className="p-0">
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
      body.push(
        <tr key={`h-${heltes.key}`}>
          <td colSpan={colSpan} className="p-0">
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
        body.push(
          <tr key={`a-${alba.key}`}>
            <td colSpan={colSpan} className="p-0">
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
          body.push(
            <tr
              key={row.id}
              className="border-b border-slate-100 hover:bg-slate-50"
            >
              <td className="px-2 py-1.5 tabular-nums text-xs text-slate-500">
                {counter}
              </td>
              <td className="py-1.5 pr-2">
                <Link
                  href={`/positions/${row.id}/preview`}
                  className="font-medium hover:underline"
                >
                  {row.name}
                </Link>
              </td>
              <td className="py-1.5 pr-2 font-mono text-xs">
                {row.official_code || "—"}
              </td>
              <td className="py-1.5 pr-2">
                <ScoreChip score={row.policy_avg_score} />
              </td>
              <td className="py-1.5 pr-2 tabular-nums">{row.policy_count}</td>
              <td className="py-1.5 pr-2 tabular-nums">{row.clause_count}</td>
              <td className="py-1.5 pr-2">
                {row.has_job_description ? (
                  <Badge className="bg-emerald-100 text-emerald-800">Тийм</Badge>
                ) : (
                  <Badge className="bg-amber-100 text-amber-900">Үгүй</Badge>
                )}
              </td>
              <td className="py-1.5 pr-2">
                <ScoreChip score={row.description_score} />
              </td>
            </tr>,
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
        <span className="self-center text-slate-500">{rows.length} ажлын байр</span>
      </div>

      <div className="soft-scroll max-h-[520px] overflow-auto rounded border border-slate-200">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-2 py-1.5">#</th>
              <th className="py-1.5 pr-2">Ажлын байр</th>
              <th className="py-1.5 pr-2">Албан тушаалын код</th>
              <th className="py-1.5 pr-2">Ж-үнэлгээ</th>
              <th className="py-1.5 pr-2">Журмын тоо</th>
              <th className="py-1.5 pr-2">Заалтын тоо</th>
              <th className="py-1.5 pr-2">Тодорхойлолт</th>
              <th className="py-1.5 pr-2">Т-үнэлгээ</th>
            </tr>
          </thead>
          <tbody>{body}</tbody>
        </table>
      </div>
    </div>
  );
}
