"use client";

import { useMemo, useState } from "react";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { ReportsFrame } from "@/components/reports/ReportsFrame";
import {
  FolderTree,
  filterTree,
  type TreeOpenMode,
} from "@/components/reports/FolderTree";
import { ExportBar } from "@/components/reports/ExportBar";
import type { TreeNode } from "@/lib/reports/types";

function flatten(nodes: TreeNode[], path: string[] = []): string[][] {
  const rows: string[][] = [];
  for (const n of nodes) {
    const next = [...path, n.label];
    rows.push([
      next.join(" / "),
      n.kind,
      String(n.count ?? ""),
      n.href ?? "",
    ]);
    if (n.children?.length) rows.push(...flatten(n.children, next));
  }
  return rows;
}

function TreeBody({ tree }: { tree: TreeNode[] }) {
  const [query, setQuery] = useState("");
  const [openMode, setOpenMode] = useState<TreeOpenMode>("smart");
  const filtered = useMemo(() => filterTree(tree, query), [tree, query]);
  const rows = [
    ["Зам", "Төрөл", "Тоо", "Холбоос"],
    ...flatten(filtered),
  ];

  return (
    <>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2 print:hidden">
          <button type="button" className="btn" onClick={() => setOpenMode("all")}>
            <ChevronsUpDown size={14} /> Бүгдийг дэлгэх
          </button>
          <button type="button" className="btn" onClick={() => setOpenMode("none")}>
            <ChevronsDownUp size={14} /> Бүгдийг хураах
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            className="input sm:w-56 print:hidden"
            placeholder="Хавтас, тайлан хайх"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (e.target.value) setOpenMode("all");
            }}
          />
          <ExportBar filename="dxshh-havtas" extraRows={rows} />
        </div>
      </div>
      <section className="rounded-md border border-[var(--border)] bg-[var(--card)] p-2">
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-sm text-[var(--muted)]">Тохирох хавтас алга.</p>
        ) : (
          <FolderTree nodes={filtered} openMode={query ? "all" : openMode} />
        )}
      </section>
    </>
  );
}

export default function ReportTreePage() {
  return (
    <ReportsFrame
      title="Хавтас"
      description="ДХШХ-ийн нэгдсэн удирдлагын модыг дэлгэж, хурааж, дэд хуудас руу шилжинэ."
    >
      {({ data }) => <TreeBody tree={data?.tree ?? []} />}
    </ReportsFrame>
  );
}
