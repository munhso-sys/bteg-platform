"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen } from "lucide-react";
import { TableScroll } from "@/components/ui/primitives";

export type ViolationLeaf = {
  key: string;
  label: string;
  violationCount: number;
  openCount: number;
  resolvedPercent: number | null;
};

export type ViolationFolder = {
  key: string;
  label: string;
  children: Array<ViolationFolder | ViolationLeaf>;
};

function isFolder(
  node: ViolationFolder | ViolationLeaf,
): node is ViolationFolder {
  return "children" in node;
}

function percent(value: number | null | undefined) {
  if (value == null) return "-";
  return `${Math.round(value * 100)}%`;
}

function sumViolations(node: ViolationFolder | ViolationLeaf): number {
  if (!isFolder(node)) return node.violationCount;
  return node.children.reduce((total, child) => total + sumViolations(child), 0);
}

function sumOpen(node: ViolationFolder | ViolationLeaf): number {
  if (!isFolder(node)) return node.openCount;
  return node.children.reduce((total, child) => total + sumOpen(child), 0);
}

function pruneEmpty(nodes: ViolationFolder[]): ViolationFolder[] {
  return nodes
    .map((folder) => {
      const children = folder.children
        .map((child) => {
          if (isFolder(child)) {
            const nested = pruneEmpty([child]);
            return nested[0] ?? null;
          }
          return child.violationCount > 0 ? child : null;
        })
        .filter((child): child is ViolationFolder | ViolationLeaf =>
          Boolean(child),
        );
      return { ...folder, children };
    })
    .filter((folder) => folder.children.length > 0);
}

function collectExpandableKeys(nodes: ViolationFolder[]): string[] {
  const keys: string[] = [];
  for (const folder of nodes) {
    keys.push(folder.key);
    for (const child of folder.children) {
      if (isFolder(child)) keys.push(...collectExpandableKeys([child]));
    }
  }
  return keys;
}

function FolderRow({
  folder,
  depth,
  open,
  onToggle,
}: {
  folder: ViolationFolder;
  depth: number;
  open: boolean;
  onToggle: () => void;
}) {
  const violations = sumViolations(folder);
  const openCount = sumOpen(folder);
  const Icon = open ? FolderOpen : Folder;
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <tr className="bg-slate-50/80">
      <td colSpan={2} className="align-middle">
        <button
          type="button"
          className="flex w-full items-center gap-1.5 py-0.5 text-left text-sm font-semibold text-[var(--fg)]"
          style={{ paddingLeft: `${depth * 1.1}rem` }}
          onClick={onToggle}
          aria-expanded={open}
        >
          <Chevron size={14} className="shrink-0 text-[var(--muted)]" />
          <Icon size={14} className="shrink-0 text-[var(--brand)]" />
          <span className="min-w-0 break-words">{folder.label}</span>
        </button>
      </td>
      <td className="align-middle tabular-nums font-semibold">{violations}</td>
      <td className="align-middle tabular-nums">{openCount}</td>
      <td className="align-middle text-[var(--muted)]">—</td>
    </tr>
  );
}

function LeafRow({ leaf, depth }: { leaf: ViolationLeaf; depth: number }) {
  return (
    <tr>
      <td colSpan={2} className="align-top">
        <div
          className="line-clamp-3 break-words text-sm"
          style={{ paddingLeft: `${depth * 1.1 + 1.4}rem` }}
          title={leaf.label}
        >
          {leaf.label}
        </div>
      </td>
      <td className="align-top tabular-nums">{leaf.violationCount}</td>
      <td className="align-top tabular-nums">{leaf.openCount}</td>
      <td className="align-top tabular-nums">
        {percent(leaf.resolvedPercent)}
      </td>
    </tr>
  );
}

function renderNodes(
  nodes: Array<ViolationFolder | ViolationLeaf>,
  depth: number,
  expanded: Set<string>,
  toggle: (key: string) => void,
): ReactNode[] {
  const rows: ReactNode[] = [];
  for (const node of nodes) {
    if (isFolder(node)) {
      const open = expanded.has(node.key);
      rows.push(
        <FolderRow
          key={node.key}
          folder={node}
          depth={depth}
          open={open}
          onToggle={() => toggle(node.key)}
        />,
      );
      if (open) {
        rows.push(...renderNodes(node.children, depth + 1, expanded, toggle));
      }
    } else {
      rows.push(<LeafRow key={node.key} leaf={node} depth={depth} />);
    }
  }
  return rows;
}

export function ViolationTreeTable({
  roots,
  emptyMessage,
}: {
  roots: ViolationFolder[];
  emptyMessage: string;
}) {
  const pruned = useMemo(() => pruneEmpty(roots), [roots]);
  const allExpandableKeys = useMemo(
    () => collectExpandableKeys(pruned),
    [pruned],
  );
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [prunedEpoch, setPrunedEpoch] = useState(pruned);
  if (pruned !== prunedEpoch) {
    setPrunedEpoch(pruned);
    setExpanded(new Set());
  }

  function toggle(key: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn px-2 py-1 text-xs"
          onClick={() => setExpanded(new Set(allExpandableKeys))}
        >
          Бүгдийг нээх
        </button>
        <button
          type="button"
          className="btn px-2 py-1 text-xs"
          onClick={() => setExpanded(new Set())}
        >
          Бүгдийг хураах
        </button>
        <span className="self-center text-xs text-[var(--muted)]">
          Зөвхөн зөрчил бүртгэгдсэн зүйл/үзүүлэлт
        </span>
      </div>
      <TableScroll size="lg" maxHeightClass="max-h-[36rem]">
        <table className="table-fixed text-sm">
          <thead>
            <tr>
              <th className="w-[70%]" colSpan={2}>
                Ангилал / зүйл
              </th>
              <th className="w-[10%]">Зөрчил</th>
              <th className="w-[10%]">Арилаагүй</th>
              <th className="w-[10%]">Арилгасан</th>
            </tr>
          </thead>
          <tbody>
            {pruned.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-8 text-center text-sm text-[var(--muted)]"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              renderNodes(pruned, 0, expanded, toggle)
            )}
          </tbody>
        </table>
      </TableScroll>
    </div>
  );
}
