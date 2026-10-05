"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
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

type MenuPos = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  openUp: boolean;
};

const VIEWPORT_PAD = 8;
const MENU_MIN_HEIGHT = 160;

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
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPos | null>(null);
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

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PAD;
    const spaceAbove = rect.top - VIEWPORT_PAD;
    const openUp = spaceBelow < MENU_MIN_HEIGHT && spaceAbove > spaceBelow;
    const available = Math.max(openUp ? spaceAbove : spaceBelow, MENU_MIN_HEIGHT);
    const maxHeight = Math.min(320, available);
    setPos({
      top: openUp ? rect.top - maxHeight - 4 : rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 240),
      maxHeight,
      openUp,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    updatePosition();
    const onReposition = () => updatePosition();
    window.addEventListener("resize", onReposition);
    // Capture scroll from any ancestor (panel/section) so the menu stays aligned.
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updatePosition, expanded, loadingKey, localTree]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (rootRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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

  const menu =
    open && pos
      ? createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              width: pos.width,
              maxHeight: pos.maxHeight,
              zIndex: 80,
            }}
            className="soft-scroll overflow-y-auto overflow-x-hidden rounded border border-[var(--border)] bg-[var(--card)] text-[var(--fg)] shadow-xl"
          >
            {(scopeLeaves ?? []).length > 0 ? (
              <div className="border-b border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => toggle("scope")}
                  className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs font-semibold text-[var(--fg)] hover:bg-[var(--surface-muted)]"
                >
                  {expanded.has("scope") ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                  {expanded.has("scope") ? (
                    <FolderOpen size={14} className="text-orange-500" />
                  ) : (
                    <Folder size={14} className="text-[var(--muted)]" />
                  )}
                  Хамрах хүрээ (нийтээр)
                </button>
                {expanded.has("scope")
                  ? scopeLeaves!.map((leaf) => (
                      <button
                        key={leaf.id}
                        type="button"
                        role="option"
                        aria-selected={value === leaf.id}
                        onClick={() => pick(leaf.id)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 px-2 py-1.5 pl-9 text-left text-sm hover:bg-orange-500/10",
                          value === leaf.id &&
                            "bg-orange-500/15 font-medium text-orange-900 dark:text-orange-100",
                        )}
                      >
                        <span className="min-w-0 truncate">{leaf.label}</span>
                        {leaf.meta ? (
                          <span className="shrink-0 text-[11px] text-[var(--muted)]">
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
                  className="border-b border-[var(--border)]/60 last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => toggle(hKey)}
                    className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-xs font-semibold text-[var(--fg)] hover:bg-[var(--surface-muted)]"
                  >
                    {hOpen ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                    {hOpen ? (
                      <FolderOpen size={14} className="text-orange-500" />
                    ) : (
                      <Folder size={14} className="text-[var(--muted)]" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{h.label}</span>
                    <span className="text-[11px] font-normal text-[var(--muted)]">
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
                              className="flex w-full items-center gap-1.5 px-2 py-1.5 pl-5 text-left text-xs font-medium text-[var(--fg)]/90 hover:bg-[var(--surface-muted)]"
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
                                <Folder
                                  size={14}
                                  className="text-[var(--muted)]"
                                />
                              )}
                              <span className="min-w-0 flex-1 truncate">
                                {a.label}
                              </span>
                              <span className="text-[11px] font-normal text-[var(--muted)]">
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
                                    role="option"
                                    aria-selected={value === leaf.id}
                                    onClick={() => pick(leaf.id)}
                                    className={cn(
                                      "flex w-full items-center justify-between gap-2 px-2 py-1.5 pl-12 text-left text-sm hover:bg-orange-500/10",
                                      value === leaf.id &&
                                        "bg-orange-500/15 font-medium text-orange-900 dark:text-orange-100",
                                    )}
                                  >
                                    <span className="min-w-0 truncate">
                                      {leaf.label}
                                    </span>
                                    {leaf.meta ? (
                                      <span className="shrink-0 text-[11px] text-[var(--muted)]">
                                        {leaf.meta}
                                      </span>
                                    ) : null}
                                  </button>
                                ))
                              : null}
                            {aOpen && loadingKey === aKey ? (
                              <p className="px-12 py-1 text-[11px] text-[var(--muted)]">
                                Ачаалж байна…
                              </p>
                            ) : null}
                            {aOpen &&
                            !loadingKey &&
                            !a.lazy &&
                            a.leaves.length === 0 ? (
                              <p className="px-12 py-1 text-[11px] text-[var(--muted)]">
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
              <p className="px-3 py-2 text-xs text-[var(--muted)]">
                Сонголт байхгүй.
              </p>
            ) : null}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={value} required={required} />
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded border border-[var(--border)] bg-[var(--card)] px-2 py-1.5 text-left text-sm text-[var(--fg)]",
          open && "border-orange-400 ring-1 ring-orange-200/80",
        )}
      >
        <span
          className={cn(
            "min-w-0 truncate",
            !selectedLabel && "text-[var(--muted)]",
          )}
        >
          {selectedLabel || placeholder}
        </span>
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {menu}
    </div>
  );
}
