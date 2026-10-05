"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type JdSectionKey = "A" | "B" | "C" | "D" | "E";

const DEFAULT_OPEN: Record<JdSectionKey, boolean> = {
  A: true,
  B: false,
  C: false,
  D: false,
  E: false,
};

/** АБТ Загвар.docx А–E бүлгийн collapse/expand толгой. */
export function JdCollapsibleSection({
  title,
  children,
  open,
  onOpenChange,
  defaultOpen = false,
  className,
  badge,
}: {
  title: string;
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  defaultOpen?: boolean;
  className?: string;
  badge?: React.ReactNode;
}) {
  const [internal, setInternal] = useState(defaultOpen);
  const isOpen = open ?? internal;
  const setOpen = (next: boolean) => {
    if (onOpenChange) onOpenChange(next);
    else setInternal(next);
  };

  return (
    <section className={cn("overflow-hidden", className)}>
      <button
        type="button"
        onClick={() => setOpen(!isOpen)}
        aria-expanded={isOpen}
        className="flex w-full items-center gap-2 border border-slate-800 bg-slate-800 px-3 py-2 text-left text-white hover:bg-slate-700"
      >
        <span className="shrink-0 opacity-90">
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <span className="min-w-0 flex-1 text-[13px] font-bold uppercase tracking-wide">
          {title}
        </span>
        {badge}
        <span
          className={cn(
            "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium",
            isOpen ? "bg-white/20 text-white" : "bg-white/10 text-slate-200",
          )}
        >
          {isOpen ? "Нээлттэй" : "Хаагдсан"}
        </span>
      </button>
      {isOpen ? (
        <div className="border border-t-0 border-slate-800">{children}</div>
      ) : null}
    </section>
  );
}

export function useJdSectionOpenState(
  initial: Partial<Record<JdSectionKey, boolean>> = {},
) {
  const [openMap, setOpenMap] = useState<Record<JdSectionKey, boolean>>({
    ...DEFAULT_OPEN,
    ...initial,
  });

  function setSection(key: JdSectionKey, open: boolean) {
    setOpenMap((prev) => ({ ...prev, [key]: open }));
  }

  function expandAll() {
    setOpenMap({ A: true, B: true, C: true, D: true, E: true });
  }

  function collapseAll() {
    setOpenMap({ A: false, B: false, C: false, D: false, E: false });
  }

  return { openMap, setSection, expandAll, collapseAll };
}

export function JdSectionControls({
  onExpandAll,
  onCollapseAll,
}: {
  onExpandAll: () => void;
  onCollapseAll: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onExpandAll}
        className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        Бүгдийг нээх
      </button>
      <button
        type="button"
        onClick={onCollapseAll}
        className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        Бүгдийг хумих
      </button>
    </div>
  );
}
