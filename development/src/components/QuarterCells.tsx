"use client";

import type { ProgramInitiative, QuarterKey } from "@/lib/types";
import {
  QUARTER_META,
  isQuarterCurrent,
  resolveQuarterView,
  type QuarterView,
} from "@/lib/quarters";

const VIEW_CLASS: Record<QuarterView, string> = {
  none: "border-[var(--border)] bg-white text-[var(--muted)]",
  planned: "border-amber-300 bg-amber-50 text-amber-800",
  done: "border-[var(--brand)] bg-[#e5f4dc] text-[var(--brand-dark)]",
  delayed: "border-rose-300 bg-rose-50 text-rose-700",
};

const VIEW_MARK: Record<QuarterView, string> = {
  none: "–",
  planned: "○",
  done: "✓",
  delayed: "!",
};

const VIEW_TITLE: Record<QuarterView, string> = {
  none: "Төлөвлөөгүй",
  planned: "Төлөвлөсөн",
  done: "Хийсэн",
  delayed: "Хоцорсон — улирал дууссан, гүйцэтгээгүй",
};

export function QuarterCells({
  item,
  interactive = false,
  onToggle,
}: {
  item: ProgramInitiative;
  interactive?: boolean;
  onToggle?: (key: QuarterKey) => void;
}) {
  return (
    <>
      {QUARTER_META.map((q) => {
        const view = resolveQuarterView(item, q.key);
        const current = isQuarterCurrent(item.year, q.key);
        const className = `inline-flex h-7 w-7 items-center justify-center rounded border p-0 text-sm font-semibold ${VIEW_CLASS[view]} ${
          current ? "ring-2 ring-[var(--brand)] ring-offset-1" : ""
        } ${interactive ? "cursor-pointer" : ""}`;
        const title = `${q.label} улирал · ${q.months} · ${VIEW_TITLE[view]}${
          current ? " · одоо" : ""
        }${interactive ? " · дараад солино" : ""}`;

        return (
          <td key={q.key} className="w-12 text-center">
            {interactive ? (
              <button
                type="button"
                className={className}
                title={title}
                aria-label={title}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggle?.(q.key);
                }}
              >
                {VIEW_MARK[view]}
              </button>
            ) : (
              <span className={className} title={title}>
                {VIEW_MARK[view]}
              </span>
            )}
          </td>
        );
      })}
    </>
  );
}

export function QuarterHeaders({ year }: { year: number }) {
  return (
    <>
      {QUARTER_META.map((q) => {
        const current = isQuarterCurrent(year, q.key);
        return (
          <th
            key={q.key}
            className={`w-12 text-center ${current ? "text-[var(--brand)]" : ""}`}
            title={`${q.label} улирал · ${q.months}${current ? " · одоо" : ""}`}
          >
            {q.label}
            {current ? (
              <div className="text-[10px] font-medium normal-case tracking-normal">
                одоо
              </div>
            ) : null}
          </th>
        );
      })}
    </>
  );
}

export function QuarterLegend() {
  const items: Array<{ view: QuarterView; label: string }> = [
    { view: "none", label: "Төлөвлөөгүй" },
    { view: "planned", label: "Төлөвлөсөн" },
    { view: "done", label: "Хийсэн" },
    { view: "delayed", label: "Хоцорсон" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted)]">
      {items.map((item) => (
        <span key={item.view} className="inline-flex items-center gap-1.5">
          <span
            className={`inline-flex h-5 w-5 items-center justify-center rounded border ${VIEW_CLASS[item.view]}`}
          >
            {VIEW_MARK[item.view]}
          </span>
          {item.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-[var(--border)] ring-2 ring-[var(--brand)] ring-offset-1">
          ○
        </span>
        Одоогийн улирал
      </span>
    </div>
  );
}
