"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { FileText, GripVertical, Plus } from "lucide-react";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { CollapsiblePanel } from "@/components/ui/collapsible-panel";
import {
  aggregateLinksByPosition,
  type AggregatedPositionRow,
  type LinkScoreRow,
} from "@/lib/policy-kpis";
import { cn } from "@/lib/utils";
import {
  JOB_POSITION_DRAG_MIME,
  usePolicyJobDrag,
  type DragJobPosition,
} from "@/components/policies/policy-job-drag-context";
import { useCanAccessPolicyPath } from "@/lib/access/PolicyNavContext";

function orgUnitLabels(row: AggregatedPositionRow): {
  heltes: string;
  alba: string;
  uncategorized: boolean;
} {
  const heltes = (row.heltesName ?? "").trim() || "Ангилагдаагүй";
  const albaRaw = (row.albaName ?? "").trim();
  const alba = !albaRaw || albaRaw === "—" ? "—" : albaRaw;
  const uncategorized =
    heltes === "Ангилагдаагүй" || alba === "—";
  return { heltes, alba, uncategorized };
}

type OrgHoverTipState = {
  name: string;
  heltes: string;
  alba: string;
  uncategorized: boolean;
  top: number;
  left: number;
};

/** Org path is hidden in the list; shown only on hover (portal, not clipped by scroll). */
function OrgHoverTip({ tip }: { tip: OrgHoverTipState | null }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || !tip) return null;
  return createPortal(
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[80] max-w-[16rem] rounded border border-[var(--border)] bg-[var(--card)] px-2.5 py-2 text-[11px] shadow-lg"
      style={{ top: tip.top, left: tip.left }}
    >
      <div className="truncate font-medium text-[var(--fg)]">{tip.name}</div>
      <div className="mt-1 space-y-0.5 text-[var(--muted)]">
        <div>
          <span className="text-[10px] uppercase tracking-wide">Хэлтэс</span>
          {": "}
          <span className="text-[var(--fg)]">{tip.heltes}</span>
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-wide">Алба</span>
          {": "}
          <span className="text-[var(--fg)]">{tip.alba}</span>
        </div>
      </div>
      {tip.uncategorized ? (
        <p className="mt-1.5 text-[10px] text-amber-800 dark:text-amber-200">
          Ангилагдаагүй / буруу нэгж байж болзошгүй — шалгана уу.
        </p>
      ) : null}
    </div>,
    document.body,
  );
}

function showOrgHoverFromEvent(
  e: MouseEvent<HTMLElement>,
  row: AggregatedPositionRow,
  setTip: (tip: OrgHoverTipState | null) => void,
) {
  const org = orgUnitLabels(row);
  const rect = e.currentTarget.getBoundingClientRect();
  const width = 256;
  const left = Math.min(
    Math.max(8, rect.left),
    window.innerWidth - width - 8,
  );
  const top = Math.min(rect.bottom + 6, window.innerHeight - 100);
  setTip({
    name: row.positionName,
    heltes: org.heltes,
    alba: org.alba,
    uncategorized: org.uncategorized,
    top,
    left,
  });
}

function ConnectedPositionStats({ row }: { row: AggregatedPositionRow }) {
  const clauseCount = row.clauseIds.length;
  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--muted)]">
      <span
        className="inline-flex items-center gap-0.5 rounded border border-[var(--border)] bg-[var(--card)] px-1 py-0.5 tabular-nums text-[var(--fg)]"
        title="Холбогдсон зүйл / заалт"
      >
        <FileText size={10} />
        {clauseCount} зүйл
      </span>
      <span
        className="inline-flex items-center gap-0.5 rounded border border-amber-500/40 bg-amber-500/15 px-1 py-0.5 tabular-nums text-amber-950 dark:text-amber-100"
        title="Дундаж үнэлгээ"
      >
        ⌀{row.avgScore != null ? row.avgScore : "—"}
      </span>
      {row.linkCount > clauseCount ? (
        <span className="tabular-nums" title="Үүргийн төрлөөр">
          {row.linkCount} холбоос
        </span>
      ) : null}
    </div>
  );
}

/** Sidebar list of positions linked on this policy — same source as the drag tray. */
export function ConnectedPositionsPanel({
  policyId,
  linkRows,
  defaultOpen = false,
}: {
  policyId: string;
  linkRows: LinkScoreRow[];
  defaultOpen?: boolean;
}) {
  const rows = useMemo(() => aggregateLinksByPosition(linkRows), [linkRows]);
  const [orgTip, setOrgTip] = useState<OrgHoverTipState | null>(null);
  const canOpenPositionManage = useCanAccessPolicyPath("/positions");

  return (
    <CollapsiblePanel
      title="Холбогдсон ажлын байр"
      defaultOpen={defaultOpen}
      badge={
        <span className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--muted)]">
          {rows.length}
        </span>
      }
    >
      <OrgHoverTip tip={orgTip} />
      {rows.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">Холбоосгүй.</p>
      ) : (
        <ul className="max-h-80 space-y-1.5 overflow-auto text-sm">
          {rows.map((r) => (
            <li
              key={r.job_position_id}
              className="rounded border border-[var(--border)]/70 bg-[var(--surface-muted)]/40 px-2 py-1.5"
              onMouseEnter={(e) => showOrgHoverFromEvent(e, r, setOrgTip)}
              onMouseLeave={() => setOrgTip(null)}
            >
              {canOpenPositionManage ? (
                <Link
                  href={`/positions/${r.job_position_id}?from=policy&policyId=${encodeURIComponent(policyId)}`}
                  className="block truncate font-medium text-[var(--fg)] hover:underline"
                >
                  {r.positionName}
                </Link>
              ) : (
                <span className="block truncate font-medium text-[var(--fg)]">
                  {r.positionName}
                </span>
              )}
              <ConnectedPositionStats row={r} />
            </li>
          ))}
        </ul>
      )}
    </CollapsiblePanel>
  );
}

/**
 * Drag source for desktop linking — single list of connected positions
 * (replaces the old separate “Холбогдсон ажлын байр” panel to avoid duplicates).
 * Multi-select (checkbox / Ctrl+click) then drag onto clause «+».
 */
export function JobPositionDragTray({
  policyId,
  linkRows,
}: {
  policyId: string;
  linkRows: LinkScoreRow[];
}) {
  const drag = usePolicyJobDrag();
  const rows = useMemo(() => aggregateLinksByPosition(linkRows), [linkRows]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [orgTip, setOrgTip] = useState<OrgHoverTipState | null>(null);
  const canOpenPositionManage = useCanAccessPolicyPath("/positions");

  const rowIds = useMemo(
    () => new Set(rows.map((r) => r.job_position_id)),
    [rows],
  );

  // Drop selection for positions that are no longer linked.
  useEffect(() => {
    setSelected((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (rowIds.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [rowIds]);

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const selectedCount = selected.size;

  function toggleOne(id: string, additive: boolean) {
    setSelected((prev) => {
      if (additive) {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }
      if (prev.size === 1 && prev.has(id)) return new Set();
      return new Set([id]);
    });
  }

  function selectAll() {
    setSelected(new Set(rows.map((r) => r.job_position_id)));
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function positionsForDrag(startId: string): DragJobPosition[] {
    const fromSelection =
      selected.has(startId) && selected.size > 0
        ? rows.filter((r) => selected.has(r.job_position_id))
        : rows.filter((r) => r.job_position_id === startId);
    return fromSelection.map((r) => ({
      id: r.job_position_id,
      name: r.positionName,
    }));
  }

  if (!drag) return null;

  return (
    <section className="rounded border border-[var(--border)] bg-[var(--card)]">
      <OrgHoverTip tip={orgTip} />
      <div className="border-b border-[var(--border)] px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--fg)]">
            Холбогдсон ажлын байр
          </h2>
          <span className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--muted)]">
            {rows.length}
          </span>
        </div>
        <p className="mt-0.5 text-[11px] text-[var(--muted)]">
          Сонгоод зүйлийн «+» дээр чирнэ. Нэр дээр дарж дэлгэрэнгүй рүү орно.
        </p>
      </div>
      <div className="space-y-2 p-3">
        {rows.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-[11px]">
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-[var(--muted)] hover:text-[var(--fg)]">
              <input
                type="checkbox"
                className="rounded border-[var(--border)]"
                checked={allSelected}
                ref={(el) => {
                  if (el) {
                    el.indeterminate =
                      selectedCount > 0 && selectedCount < rows.length;
                  }
                }}
                onChange={() => {
                  if (allSelected) clearSelection();
                  else selectAll();
                }}
              />
              Бүгдийг сонгох
            </label>
            {selectedCount > 0 ? (
              <>
                <span className="tabular-nums text-[var(--fg)]">
                  {selectedCount} сонгосон
                </span>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="text-[var(--muted)] hover:text-[var(--fg)] hover:underline"
                >
                  Цэвэрлэх
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        {drag.lastError ? (
          <p className="text-[11px] text-rose-700 dark:text-rose-300">
            {drag.lastError}
          </p>
        ) : null}

        {rows.length === 0 ? (
          <p className="rounded border border-dashed border-[var(--border)] px-2 py-3 text-center text-[11px] text-[var(--muted)]">
            Эхлээд form-оор ажлын байр холбоно. Дараа нь эндээс бусад зүйл рүү
            чирж нэмнэ.
          </p>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {rows.map((r) => {
              const id = r.job_position_id;
              const isSelected = selected.has(id);
              return (
                <li key={id}>
                  <div
                    draggable
                    onDragStart={(e) => {
                      setOrgTip(null);
                      const payload = positionsForDrag(id);
                      const data = JSON.stringify({ positions: payload });
                      e.dataTransfer.setData(JOB_POSITION_DRAG_MIME, data);
                      e.dataTransfer.setData("text/plain", data);
                      e.dataTransfer.effectAllowed = "copy";
                      drag.setDragging(true);
                      drag.clearError();
                    }}
                    onDragEnd={() => drag.setDragging(false)}
                    onMouseEnter={(e) => showOrgHoverFromEvent(e, r, setOrgTip)}
                    onMouseLeave={() => setOrgTip(null)}
                    onClick={(e) => {
                      // Ctrl/Cmd+click toggles without replacing selection
                      toggleOne(id, e.metaKey || e.ctrlKey || e.shiftKey);
                    }}
                    className={cn(
                      "flex cursor-grab items-start gap-1.5 rounded border px-1.5 py-1.5 active:cursor-grabbing",
                      isSelected
                        ? "border-orange-400/70 bg-orange-500/15"
                        : "border-[var(--border)] bg-[var(--surface-muted)]",
                      drag.dragging && isSelected && "opacity-80",
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 shrink-0 rounded border-[var(--border)]"
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleOne(id, true)}
                      aria-label={`${r.positionName} сонгох`}
                    />
                    <GripVertical
                      size={14}
                      className="mt-0.5 shrink-0 text-[var(--muted)]"
                    />
                    <div className="min-w-0 flex-1">
                      {canOpenPositionManage ? (
                        <Link
                          href={`/positions/${id}?from=policy&policyId=${encodeURIComponent(policyId)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="block truncate text-xs font-medium text-[var(--fg)] hover:underline"
                        >
                          {r.positionName}
                        </Link>
                      ) : (
                        <span className="block truncate text-xs font-medium text-[var(--fg)]">
                          {r.positionName}
                        </span>
                      )}
                      <ConnectedPositionStats row={r} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {drag.dropBusy ? (
          <p className="inline-flex items-center gap-1 text-[11px] text-orange-800 dark:text-orange-200">
            <Plus size={12} /> Холбож байна…
          </p>
        ) : null}
      </div>
    </section>
  );
}
