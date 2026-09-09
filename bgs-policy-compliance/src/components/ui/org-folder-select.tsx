"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export type OrgTreeLeaf = {
  id: string;
  label: string;
  meta?: string;
};

export type OrgTreeAlba = {
  id: string;
  label: string;
  leaves: OrgTreeLeaf[];
  /** When true, leaves load on first expand */
  lazy?: boolean;
};

export type OrgTreeHeltes = {
  id: string;
  label: string;
  albas: OrgTreeAlba[];
};

export function OrgFolderSelect({
  name,
  tree,
  value,
  onChange,
  required,
  placeholder = "Сонгох…",
  scopeLeaves,
  loadAlbaLeaves,
}: {
  name: string;
  tree: OrgTreeHeltes[];
  value: string;
  onChange: (id: string) => void;
  required?: boolean;
  placeholder?: string;
  scopeLeaves?: OrgTreeLeaf[];
  loadAlbaLeaves?: (
    heltesId: string,
    albaId: string,
  ) => Promise<OrgTreeLeaf[]>;
}) {
  const [open, setOpen] = useState(false);
  const [localTree, setLocalTree] = useState(tree);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const next = new Set<string>();
    for (const h of tree.slice(0, 1)) {
      next.add(`h:${h.id}`);
    }
    if (scopeLeaves?.length) next.add("scope");
    return next;
  });

  useEffect(() => {
    setLocalTree(tree);
  }, [tree]);

  const selectedLabel = useMemo(() => {
    for (const s of scopeLeaves ?? []) {
      if (s.id === value) return s.label;
    }
    for (const h of localTree) {
      for (const a of h.albas) {
        for (const leaf of a.leaves) {
          if (leaf.id === value) {
            return `${h.label} · ${a.label} · ${leaf.label}`;
          }
        }
      }
    }
    return "";
  }, [localTree, value, scopeLeaves]);

  async function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

    if (!key.startsWith("a:") || !loadAlbaLeaves) return;
    const parts = key.slice(2).split("::");
    if (parts.length !== 2) return;
    const [heltesId, albaId] = parts;
    const h = localTree.find((x) => x.id === heltesId);
    const a = h?.albas.find((x) => x.id === albaId);
    if (!a?.lazy || a.leaves.length > 0) return;

    setLoadingKey(key);
    try {
      const leaves = await loadAlbaLeaves(heltesId, albaId);
      setLocalTree((prev) =>
        prev.map((hh) =>
          hh.id !== heltesId
            ? hh
            : {
                ...hh,
                albas: hh.albas.map((aa) =>
                  aa.id !== albaId
                    ? aa
                    : { ...aa, leaves, lazy: false },
                ),
              },
        ),
      );
    } finally {
      setLoadingKey(null);
    }
  }

  function pick(id: string) {
    onChange(id);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} required={required} />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded border border-slate-300 bg-white px-2 py-1.5 text-left text-sm",
          open && "border-orange-400 ring-1 ring-orange-200",
        )}
      >
        <span
          className={cn("min-w-0 truncate", !selectedLabel && "text-slate-400")}
        >
          {selectedLabel || placeholder}
        </span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {open ? (
        <div className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded border border-slate-300 bg-white shadow-lg">
          {(scopeLeaves ?? []).length > 0 ? (
            <div className="border-b border-slate-100">
              <button
                type="button"
                onClick={() => toggle("scope")}
                className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                {expanded.has("scope") ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
                {expanded.has("scope") ? (
                  <FolderOpen size={14} className="text-orange-500" />
                ) : (
                  <Folder size={14} className="text-slate-400" />
                )}
                Хамрах хүрээ (нийтээр)
              </button>
              {expanded.has("scope")
                ? scopeLeaves!.map((leaf) => (
                    <button
                      key={leaf.id}
                      type="button"
                      onClick={() => pick(leaf.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-2 py-1.5 pl-9 text-left text-sm hover:bg-orange-50",
                        value === leaf.id &&
                          "bg-orange-50 font-medium text-orange-900",
                      )}
                    >
                      <span className="min-w-0 truncate">{leaf.label}</span>
                      {leaf.meta ? (
                        <span className="shrink-0 text-[11px] text-slate-500">
                          {leaf.meta}
                        </span>
                      ) : null}
                    </button>
                  ))
                : null}
            </div>
          ) : null}

          {localTree.map((h) => {
            const hKey = `h:${h.id}`;
            const hOpen = expanded.has(hKey);
            return (
              <div
                key={h.id}
                className="border-b border-slate-50 last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => toggle(hKey)}
                  className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {hOpen ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                  {hOpen ? (
                    <FolderOpen size={14} className="text-orange-500" />
                  ) : (
                    <Folder size={14} className="text-slate-400" />
                  )}
                  <span className="min-w-0 flex-1 truncate">{h.label}</span>
                  <span className="text-[11px] font-normal text-slate-400">
                    {h.albas.length}
                  </span>
                </button>
                {hOpen
                  ? h.albas.map((a) => {
                      const aKey = `a:${h.id}::${a.id}`;
                      const aOpen = expanded.has(aKey);
                      return (
                        <div key={a.id}>
                          <button
                            type="button"
                            onClick={() => void toggle(aKey)}
                            className="flex w-full items-center gap-1.5 px-2 py-1.5 pl-5 text-left text-xs font-medium text-slate-600 hover:bg-slate-50"
                          >
                            {aOpen ? (
                              <ChevronDown size={14} />
                            ) : (
                              <ChevronRight size={14} />
                            )}
                            {aOpen ? (
                              <FolderOpen
                                size={14}
                                className="text-orange-400"
                              />
                            ) : (
                              <Folder size={14} className="text-slate-400" />
                            )}
                            <span className="min-w-0 flex-1 truncate">
                              {a.label}
                            </span>
                            <span className="text-[11px] font-normal text-slate-400">
                              {loadingKey === aKey
                                ? "…"
                                : a.lazy
                                  ? "↓"
                                  : a.leaves.length}
                            </span>
                          </button>
                          {aOpen
                            ? a.leaves.map((leaf) => (
                                <button
                                  key={leaf.id}
                                  type="button"
                                  onClick={() => pick(leaf.id)}
                                  className={cn(
                                    "flex w-full items-center justify-between gap-2 px-2 py-1.5 pl-12 text-left text-sm hover:bg-orange-50",
                                    value === leaf.id &&
                                      "bg-orange-50 font-medium text-orange-900",
                                  )}
                                >
                                  <span className="min-w-0 truncate">
                                    {leaf.label}
                                  </span>
                                  {leaf.meta ? (
                                    <span className="shrink-0 text-[11px] text-slate-500">
                                      {leaf.meta}
                                    </span>
                                  ) : null}
                                </button>
                              ))
                            : null}
                          {aOpen && loadingKey === aKey ? (
                            <p className="px-12 py-1 text-[11px] text-slate-400">
                              Ачаалж байна…
                            </p>
                          ) : null}
                          {aOpen &&
                          !loadingKey &&
                          !a.lazy &&
                          a.leaves.length === 0 ? (
                            <p className="px-12 py-1 text-[11px] text-slate-400">
                              Ажлын байр байхгүй
                            </p>
                          ) : null}
                        </div>
                      );
                    })
                  : null}
              </div>
            );
          })}

          {!localTree.length && !(scopeLeaves ?? []).length ? (
            <p className="px-3 py-2 text-xs text-slate-500">Сонголт байхгүй.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
