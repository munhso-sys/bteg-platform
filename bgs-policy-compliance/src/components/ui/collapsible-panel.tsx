"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/** Sidebar panel with expand/collapse. Starts collapsed by default. */
export function CollapsiblePanel({
  title,
  children,
  className,
  defaultOpen = false,
  badge,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
  defaultOpen?: boolean;
  /** Extra status chip (e.g. count) shown in the header. */
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      className={cn(
        "min-w-0 max-w-full overflow-hidden rounded border border-[var(--border)] bg-[var(--card)]",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-x-2 gap-y-1 border-b border-[var(--border)] px-3 py-2 text-left hover:bg-[var(--surface-muted)] sm:flex-nowrap"
      >
        <span className="shrink-0 text-[var(--muted)]">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
        <h2 className="min-w-0 flex-1 basis-[min(100%,12rem)] truncate text-sm font-semibold text-[var(--fg)] sm:basis-auto">
          {title}
        </h2>
        {badge}
        <span
          className={cn(
            "ml-auto shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums sm:ml-0",
            open
              ? "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
              : "bg-[var(--surface-muted)] text-[var(--muted)]",
          )}
        >
          {open ? "Нээлттэй" : "Хаагдсан"}
        </span>
      </button>
      {open ? <div className="max-w-full p-3">{children}</div> : null}
    </section>
  );
}
