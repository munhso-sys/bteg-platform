"use client";

import { useMemo, useState } from "react";
import { ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { RiskFrame } from "@/components/risk/RiskFrame";
import {
  FolderTree,
  filterTree,
  type TreeOpenMode,
} from "@/components/reports/FolderTree";
import { buildRiskTree } from "@/lib/risk/tree";
import type { RiskOverview } from "@/lib/risk/types";

function TreeBody({ data }: { data: RiskOverview | null }) {
  const [query, setQuery] = useState("");
  const [openMode, setOpenMode] = useState<TreeOpenMode>("smart");
  const tree = useMemo(() => (data ? buildRiskTree(data) : []), [data]);
  const filtered = useMemo(() => filterTree(tree, query), [tree, query]);

  return (
    <>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={() => setOpenMode("all")}>
            <ChevronsUpDown size={14} /> Бүгдийг дэлгэх
          </button>
          <button type="button" className="btn" onClick={() => setOpenMode("none")}>
            <ChevronsDownUp size={14} /> Бүгдийг хураах
          </button>
        </div>
        <input
          className="input sm:w-56"
          placeholder="Хавтас, эрсдэл хайх"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value) setOpenMode("all");
          }}
        />
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

export default function RiskTreePage() {
  return (
    <RiskFrame
      title="Хавтас"
      description="Эрсдэлийг эх үүсвэр, зэрэглэл, засвар, нэгжээр дэлгэж, хурааж харна."
    >
      {({ data }) => <TreeBody data={data} />}
    </RiskFrame>
  );
}
