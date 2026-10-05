"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen } from "lucide-react";
import { DeleteRunButton } from "@/components/runs/DeleteRunButton";
import { StatusBadge, TableScroll } from "@/components/ui/primitives";

type Tone = "neutral" | "ok" | "warn" | "danger" | "brand";

export type RunListRow = {
  id: string;
  title: string;
  inspectionType: string;
  inspectionTypeLabel: string;
  categoryLabel: string;
  inspectedPlace: string;
  inspectionDate: string;
  dueDate: string;
  completedDate: string;
  complianceLabel: string;
  riskLabel: string;
  riskTone: Tone | null;
  statusLabel: string;
};

type FolderNode = {
  key: string;
  label: string;
  children: Array<FolderNode | RunListRow>;
};

function isFolder(node: FolderNode | RunListRow): node is FolderNode {
  return "children" in node;
}

function collectLeaves(node: FolderNode | RunListRow): RunListRow[] {
  if (!isFolder(node)) return [node];
  return node.children.flatMap((child) => collectLeaves(child));
}

function collectExpandableKeys(nodes: FolderNode[]): string[] {
  const keys: string[] = [];
  for (const folder of nodes) {
    keys.push(folder.key);
    for (const child of folder.children) {
      if (isFolder(child)) keys.push(...collectExpandableKeys([child]));
    }
  }
  return keys;
}

function buildTree(rows: RunListRow[]): FolderNode[] {
  const byType = new Map<string, RunListRow[]>();
  for (const row of rows) {
    const key = row.inspectionType || row.inspectionTypeLabel;
    const list = byType.get(key) ?? [];
    list.push(row);
    byType.set(key, list);
  }

  return [...byType.entries()]
    .map(([typeKey, typeRows]) => {
      const typeLabel = typeRows[0]?.inspectionTypeLabel || typeKey;
      const byCategory = new Map<string, RunListRow[]>();
      for (const row of typeRows) {
        const categoryKey = row.categoryLabel.trim() || "Ангилалгүй";
        const list = byCategory.get(categoryKey) ?? [];
        list.push(row);
        byCategory.set(categoryKey, list);
      }

      const categoryEntries = [...byCategory.entries()];
      const useCategories = categoryEntries.length > 1;

      const children: Array<FolderNode | RunListRow> = useCategories
        ? categoryEntries
            .map(
              ([categoryLabel, categoryRows]) =>
                ({
                  key: `type-${typeKey}::cat-${categoryLabel}`,
                  label: categoryLabel,
                  children: [...categoryRows].sort((a, b) =>
                    b.inspectionDate.localeCompare(a.inspectionDate),
                  ),
                }) satisfies FolderNode,
            )
            .sort((a, b) => a.label.localeCompare(b.label, "mn"))
        : [...typeRows].sort((a, b) =>
            b.inspectionDate.localeCompare(a.inspectionDate),
          );

      return {
        key: `type-${typeKey}`,
        label: typeLabel,
        children,
      } satisfies FolderNode;
    })
    .sort((a, b) => a.label.localeCompare(b.label, "mn"));
}

function FolderRow({
  folder,
  depth,
  open,
  onToggle,
}: {
  folder: FolderNode;
  depth: number;
  open: boolean;
  onToggle: () => void;
}) {
  const leaves = collectLeaves(folder);
  const Icon = open ? FolderOpen : Folder;
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <tr className="bg-slate-50/80">
      <td colSpan={10} className="align-middle">
        <button
          type="button"
          className="flex w-full items-center gap-2 py-0.5 text-left"
          style={{ paddingLeft: `${depth * 1.1}rem` }}
          onClick={onToggle}
          aria-expanded={open}
        >
          <Chevron size={14} className="shrink-0 text-[var(--muted)]" />
          <Icon size={14} className="shrink-0 text-[var(--brand)]" />
          <span className="min-w-0 text-sm font-semibold text-[var(--fg)]">
            {folder.label}
          </span>
          <span className="ml-auto shrink-0">
            <StatusBadge tone="brand">{leaves.length} шалгалт</StatusBadge>
          </span>
        </button>
      </td>
    </tr>
  );
}

function RunRow({
  row,
  depth,
  onDelete,
}: {
  row: RunListRow;
  depth: number;
  onDelete?: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <tr>
      <td className="col-text-primary" title={row.title}>
        <Link
          href={`/runs/${row.id}`}
          className="cell-ellipsis font-medium text-[var(--brand-dark)] hover:underline"
          style={{ paddingLeft: `${depth * 1.1 + 1.4}rem` }}
        >
          {row.title}
        </Link>
      </td>
      <td className="col-narrow text-sm">{row.categoryLabel}</td>
      <td className="col-narrow text-sm" title={row.inspectedPlace || undefined}>
        <span className="cell-ellipsis">{row.inspectedPlace || "—"}</span>
      </td>
      <td className="col-narrow-sm tabular-nums text-sm">{row.inspectionDate}</td>
      <td className="col-narrow-sm tabular-nums text-sm">{row.dueDate}</td>
      <td className="col-narrow-sm tabular-nums text-sm">
        {row.completedDate}
      </td>
      <td className="col-narrow-sm tabular-nums text-sm">
        {row.complianceLabel}
      </td>
      <td className="col-narrow text-sm">
        {row.riskTone && row.riskLabel !== "—" ? (
          <StatusBadge tone={row.riskTone}>{row.riskLabel}</StatusBadge>
        ) : (
          "—"
        )}
      </td>
      <td className="col-narrow">
        <StatusBadge tone="brand">{row.statusLabel}</StatusBadge>
      </td>
      <td className="col-actions">
        {onDelete ? (
          <DeleteRunButton runId={row.id} action={onDelete} />
        ) : null}
      </td>
    </tr>
  );
}

function renderNodes(
  nodes: Array<FolderNode | RunListRow>,
  depth: number,
  expanded: Set<string>,
  toggle: (key: string) => void,
  onDelete?: (formData: FormData) => void | Promise<void>,
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
        rows.push(
          ...renderNodes(node.children, depth + 1, expanded, toggle, onDelete),
        );
      }
    } else {
      rows.push(
        <RunRow
          key={node.id}
          row={node}
          depth={depth}
          onDelete={onDelete}
        />,
      );
    }
  }
  return rows;
}

export function RunsTypeTree({
  rows,
  onDelete,
}: {
  rows: RunListRow[];
  onDelete?: (formData: FormData) => void | Promise<void>;
}) {
  const roots = useMemo(() => buildTree(rows), [rows]);
  const allExpandableKeys = useMemo(
    () => collectExpandableKeys(roots),
    [roots],
  );
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [rootsEpoch, setRootsEpoch] = useState(roots);
  if (roots !== rootsEpoch) {
    setRootsEpoch(roots);
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
          ХШ төрөл → ангилал → шалгалт
        </span>
      </div>
      <TableScroll size="lg" maxHeightClass="max-h-[36rem]">
        <table id="runs-table">
          <thead>
            <tr>
              <th className="col-text-primary">Гарчиг</th>
              <th className="col-narrow">Ангилал</th>
              <th className="col-narrow">Байгууллага</th>
              <th className="col-narrow-sm">Эхлүүлсэн</th>
              <th className="col-narrow-sm">Дуусгах</th>
              <th className="col-narrow-sm">Дуусгасан</th>
              <th className="col-narrow-sm">Нийцэл</th>
              <th className="col-narrow">Эрсдэл</th>
              <th className="col-narrow">Төлөв</th>
              <th className="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            {roots.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="py-6 text-center text-sm text-[var(--muted)]"
                >
                  Сонгосон шүүлтүүрээр шалгалт олдсонгүй.
                </td>
              </tr>
            ) : (
              renderNodes(roots, 0, expanded, toggle, onDelete)
            )}
          </tbody>
        </table>
      </TableScroll>
    </div>
  );
}
