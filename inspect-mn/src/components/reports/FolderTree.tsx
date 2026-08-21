"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, Folder, FileBarChart2 } from "lucide-react";
import type { TreeNode } from "@/lib/reports/types";
import { cn } from "@/lib/cn";

export type TreeOpenMode = "smart" | "all" | "none";

export function FolderTree({
  nodes,
  openMode = "smart",
}: {
  nodes: TreeNode[];
  openMode?: TreeOpenMode;
}) {
  return (
    <ul className="space-y-0.5 text-sm">
      {nodes.map((n) => (
        <TreeItem key={n.id} node={n} depth={0} openMode={openMode} />
      ))}
    </ul>
  );
}

function TreeItem({
  node,
  depth,
  openMode,
}: {
  node: TreeNode;
  depth: number;
  openMode: TreeOpenMode;
}) {
  const hasChildren = Boolean(node.children?.length);
  const [open, setOpen] = useState(
    openMode === "all" || (openMode === "smart" && depth < 2),
  );

  useEffect(() => {
    const id = window.setTimeout(() => {
      if (openMode === "all") setOpen(true);
      else if (openMode === "none") setOpen(false);
      else setOpen(depth < 2);
    }, 0);
    return () => window.clearTimeout(id);
  }, [openMode, depth]);

  return (
    <li>
      <div
        className={cn(
          "flex items-center gap-1.5 rounded px-2 py-1.5 hover:bg-[var(--surface-muted)]",
        )}
        style={{ paddingLeft: `${0.5 + depth * 0.9}rem` }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="shrink-0 text-[var(--muted)]"
            aria-label={open ? "Хураах" : "Дэлгэх"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        ) : (
          <span className="w-3.5" />
        )}
        {node.kind === "folder" ? (
          <Folder size={14} className="shrink-0 text-[var(--brand)]" />
        ) : (
          <FileBarChart2 size={14} className="shrink-0 text-[var(--muted)]" />
        )}
        {node.href ? (
          <Link href={node.href} className="min-w-0 flex-1 truncate font-medium">
            {node.label}
          </Link>
        ) : (
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left font-medium"
            onClick={() => hasChildren && setOpen((v) => !v)}
          >
            {node.label}
          </button>
        )}
        {typeof node.count === "number" ? (
          <span className="tabular-nums text-xs text-[var(--muted)]">
            {node.count}
          </span>
        ) : null}
      </div>
      {hasChildren && open ? (
        <ul>
          {node.children!.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              openMode={openMode}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;
  return nodes.flatMap((node) => {
    const kids = filterTree(node.children ?? [], q);
    const match = node.label.toLowerCase().includes(q);
    if (match) return [node];
    if (kids.length) return [{ ...node, children: kids }];
    return [];
  });
}
