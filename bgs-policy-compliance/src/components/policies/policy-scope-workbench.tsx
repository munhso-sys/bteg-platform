"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  Link2,
  ListChecks,
  MessageSquareText,
  Plus,
  Star,
  Users,
} from "lucide-react";
import { Badge, ScoreChip } from "@/components/ui/primitives";
import {
  RESPONSIBILITY_LABELS,
  RESPONSIBILITY_SHORT,
  responsibilityTone,
} from "@/lib/constants";
import {
  aggregateLinksByPosition,
  computeScopeKpis,
  type LinkScoreRow,
} from "@/lib/policy-kpis";
import type { OrgAssignTree } from "@/lib/org-assign";
import { SCOPE_EVAL_PREFIX } from "@/lib/org-assign";
import type { ClauseTreeNode, ResponsibilityType } from "@/lib/types";
import { cn, truncate } from "@/lib/utils";
import { AssignResponsibilityForm } from "@/app/(app)/policies/[id]/assign-responsibility-form";
import {
  ClauseEvaluateForm,
  type EvaluateLinkOption,
} from "@/app/(app)/clauses/[id]/clause-evaluate-form";
import {
  PolicyEvaluateForm,
  type PolicyEvalOption,
} from "@/app/(app)/policies/[id]/policy-evaluate-form";
import { BulkUnlinkScopeButton } from "@/components/policies/bulk-unlink-scope-button";
import { EditResponsibilityLinkMenu } from "@/components/policies/edit-responsibility-link-menu";
import { AttentionNoteMarker } from "@/components/policies/attention-note-marker";
import { QuickEvaluatePopover } from "@/components/policies/quick-evaluate-popover";

function ScopeKpiLegend() {
  const items = [
    {
      icon: <Link2 size={11} />,
      label: "Холбоос",
      className:
        "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--fg)]",
    },
    {
      icon: <Users size={11} />,
      label: "Ажлын байр",
      className:
        "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--fg)]",
    },
    {
      icon: <span className="text-[10px] font-semibold">⌀</span>,
      label: "Дундаж оноо",
      className:
        "border-amber-500/40 bg-amber-500/15 text-amber-900 dark:text-amber-200",
    },
    {
      icon: <AlertTriangle size={11} />,
      label: "Дундажаас хассан",
      className:
        "border-amber-500/50 bg-amber-500/20 text-amber-950 dark:text-amber-100",
    },
    {
      icon: <MessageSquareText size={11} />,
      label: "Тайлбар (дундажид орно)",
      className:
        "border-sky-500/50 bg-sky-500/15 text-sky-950 dark:text-sky-100",
    },
    {
      icon: <span className="text-[10px] font-semibold">∅</span>,
      label: "Үнэлгээгүй",
      className:
        "border-rose-500/40 bg-rose-500/15 text-rose-800 dark:text-rose-200",
    },
    {
      icon: <Check size={11} />,
      label: "Бүрэн үнэлсэн",
      className:
        "border-emerald-500/40 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
    },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[var(--muted)]">
      <span className="font-medium text-[var(--fg)]">Тэмдэглэгээ:</span>
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1">
          <span
            className={cn(
              "inline-flex h-5 min-w-5 items-center justify-center rounded border px-1",
              item.className,
            )}
          >
            {item.icon}
          </span>
          {item.label}
        </span>
      ))}
    </div>
  );
}

function ScopeKpiChips({
  linkCount,
  positionCount,
  avgScore,
  unevaluatedCount,
  attentionCount,
  noteCount,
}: {
  linkCount: number;
  positionCount: number;
  avgScore: number | null;
  unevaluatedCount: number;
  attentionCount?: number;
  noteCount?: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-[11px]">
      <span
        className="inline-flex h-6 min-w-6 items-center justify-center gap-0.5 rounded border border-[var(--border)] bg-[var(--surface-muted)] px-1.5 tabular-nums text-[var(--fg)]"
        title="Холбоос"
      >
        <Link2 size={11} className="text-[var(--muted)]" />
        {linkCount}
      </span>
      <span
        className="inline-flex h-6 min-w-6 items-center justify-center gap-0.5 rounded border border-[var(--border)] bg-[var(--surface-muted)] px-1.5 tabular-nums text-[var(--fg)]"
        title="Ажлын байр"
      >
        <Users size={11} className="text-[var(--muted)]" />
        {positionCount}
      </span>
      <span
        className="inline-flex h-6 min-w-6 items-center justify-center gap-0.5 rounded border border-amber-500/40 bg-amber-500/15 px-1.5 tabular-nums text-amber-900 dark:text-amber-200"
        title="Дундаж оноо (дундажаас хассангүй)"
      >
        ⌀{avgScore != null ? avgScore : "—"}
      </span>
      {(attentionCount ?? 0) > 0 ? (
        <span
          className="inline-flex h-6 min-w-6 items-center justify-center gap-0.5 rounded border border-amber-500/50 bg-amber-500/20 px-1.5 tabular-nums text-amber-950 dark:text-amber-100"
          title="Дундажаас хассан · анхаарах"
        >
          <AlertTriangle size={11} />
          {attentionCount}
        </span>
      ) : null}
      {(noteCount ?? 0) > 0 ? (
        <span
          className="inline-flex h-6 min-w-6 items-center justify-center gap-0.5 rounded border border-sky-500/50 bg-sky-500/15 px-1.5 tabular-nums text-sky-950 dark:text-sky-100"
          title="Тайлбар/баримт · дундажид орно"
        >
          <MessageSquareText size={11} />
          {noteCount}
        </span>
      ) : null}
      {unevaluatedCount > 0 ? (
        <span
          className="inline-flex h-6 min-w-6 items-center justify-center gap-0.5 rounded border border-rose-500/40 bg-rose-500/15 px-1.5 tabular-nums text-rose-800 dark:text-rose-200"
          title="Үнэлгээгүй"
        >
          {unevaluatedCount}
        </span>
      ) : linkCount > 0 ? (
        <span
          className="inline-flex h-6 min-w-6 items-center justify-center rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 text-emerald-800 dark:text-emerald-200"
          title="Бүрэн үнэлсэн"
        >
          <Check size={12} />
        </span>
      ) : null}
    </div>
  );
}

function IconBtn({
  title,
  active,
  onClick,
  children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded border text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--fg)]",
        active
          ? "border-orange-400/60 bg-orange-500/15 text-orange-800 dark:text-orange-200"
          : "border-[var(--border)]",
      )}
    >
      {children}
    </button>
  );
}

function buildEvalOptionsForRows(
  clauseId: string,
  rows: LinkScoreRow[],
): EvaluateLinkOption[] {
  const options: EvaluateLinkOption[] = [];
  const byType = new Map<ResponsibilityType, LinkScoreRow[]>();
  for (const r of rows) {
    const list = byType.get(r.responsibility_type) ?? [];
    list.push(r);
    byType.set(r.responsibility_type, list);
  }
  for (const [type, list] of byType) {
    if (list.length >= 2) {
      options.push({
        id: `${SCOPE_EVAL_PREFIX}${clauseId}::${type}`,
        job_position_ids: list.map((r) => r.job_position_id),
        responsibility_type: type,
        label: `${RESPONSIBILITY_LABELS[type]} · бүх холбоос (${list.length}) — нийтээр`,
        group: "Хамрах хүрээ (нийтээр)",
        isScope: true,
      });
    }
  }
  for (const r of rows) {
    options.push({
      id: `${r.job_position_id}::${r.responsibility_type}`,
      job_position_ids: [r.job_position_id],
      responsibility_type: r.responsibility_type,
      label: `${r.positionName} · ${RESPONSIBILITY_LABELS[r.responsibility_type]}`,
      group: [r.heltesName, r.albaName].filter(Boolean).join(" · ") || "Бусад",
      isScope: false,
      heltesName: r.heltesName ?? undefined,
      albaName: r.albaName ?? undefined,
      positionName: r.positionName,
    });
  }
  return options;
}

function LinksPanel({
  rows,
  readOnly,
  clauseId,
  policyId,
  orgTree,
  clauses,
  sections,
  policyEvalOptions,
  lockedAssignTarget,
  showPolicyEval,
}: {
  rows: LinkScoreRow[];
  readOnly: boolean;
  clauseId?: string;
  policyId: string;
  orgTree: OrgAssignTree | null;
  clauses: Array<{
    id: string;
    label: string;
    sectionId?: string | null;
    parentId?: string | null;
  }>;
  sections: Array<{ id: string; label: string }>;
  policyEvalOptions?: PolicyEvalOption[];
  lockedAssignTarget?: string;
  showPolicyEval?: boolean;
}) {
  const [showAssign, setShowAssign] = useState(false);
  const [showEval, setShowEval] = useState(false);
  const aggregated = useMemo(
    () => aggregateLinksByPosition(rows),
    [rows],
  );
  const evalOptions = useMemo(
    () => (clauseId ? buildEvalOptionsForRows(clauseId, rows) : []),
    [clauseId, rows],
  );
  const fallbackPolicyEval = useMemo((): PolicyEvalOption[] => {
    if (policyEvalOptions && policyEvalOptions.length > 0) {
      return policyEvalOptions;
    }
    if (clauseId || !rows.length) return [];
    const byType = new Map<
      ResponsibilityType,
      { clauseIds: Set<string>; positionIds: Set<string> }
    >();
    for (const r of rows) {
      let row = byType.get(r.responsibility_type);
      if (!row) {
        row = { clauseIds: new Set(), positionIds: new Set() };
        byType.set(r.responsibility_type, row);
      }
      row.clauseIds.add(r.policy_clause_id);
      row.positionIds.add(r.job_position_id);
    }
    return [...byType.entries()].map(([type, row]) => ({
      id: `fallback::${type}`,
      label: `${RESPONSIBILITY_LABELS[type]} (${row.positionIds.size} ажлын байр × ${row.clauseIds.size} зүйл) — нийтээр`,
      group: "Нийтээр үнэлэх",
      policy_clause_ids: [...row.clauseIds],
      job_position_ids: [...row.positionIds],
      responsibility_type: type,
    }));
  }, [policyEvalOptions, clauseId, rows]);

  return (
    <div className="mt-2 space-y-2 rounded border border-[var(--border)] bg-[var(--surface-muted)] p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-medium text-[var(--fg)]">
          Холбогдсон ажлын байр
          <span className="ml-1 font-normal text-[var(--muted)]">
            (үнэлгээ: бага → их)
          </span>
        </div>
        {!readOnly ? (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => {
                setShowAssign((v) => !v);
                setShowEval(false);
              }}
              className={cn(
                "inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px]",
                showAssign
                  ? "border-orange-400/60 bg-orange-500/15 text-orange-800 dark:text-orange-200"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--fg)]",
              )}
            >
              <Plus size={12} />
              Ажлын байр холбох
            </button>
            <button
              type="button"
              onClick={() => {
                setShowEval((v) => !v);
                setShowAssign(false);
              }}
              className={cn(
                "inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px]",
                showEval
                  ? "border-orange-400/60 bg-orange-500/15 text-orange-800 dark:text-orange-200"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--fg)]",
              )}
            >
              <Star size={12} />
              Үнэлгээ өгөх
            </button>
          </div>
        ) : null}
      </div>

      {aggregated.length === 0 ? (
        <p className="px-1 py-2 text-xs text-[var(--muted)]">
          Холбоос байхгүй. «Ажлын байр холбох»-оор нэмнэ үү.
        </p>
      ) : (
        <ul className="max-h-56 space-y-0.5 overflow-y-auto overflow-x-hidden rounded border border-[var(--border)] bg-[var(--card)] text-sm">
          {aggregated.map((r) => (
            <li
              key={r.job_position_id}
              className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-2 py-1.5 last:border-b-0"
            >
              <div className="min-w-0 flex-1 overflow-hidden">
                {readOnly ? (
                  <span className="block truncate">{r.positionName}</span>
                ) : (
                  <Link
                    href={`/positions/${r.job_position_id}?from=policy&policyId=${encodeURIComponent(policyId)}`}
                    className="block truncate hover:underline"
                  >
                    {r.positionName}
                  </Link>
                )}
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {r.types.map((t) => (
                    <Badge
                      key={t}
                      className={cn("text-[10px]", responsibilityTone(t))}
                    >
                      {RESPONSIBILITY_SHORT[t]}
                    </Badge>
                  ))}
                  {r.linkCount > 1 ? (
                    <span
                      className="text-[10px] text-[var(--muted)]"
                      title="Доод зүйлүүдийн холбоос"
                    >
                      {r.linkCount} холбоос · ⌀
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {r.excludeFromAverage ? (
                  <AttentionNoteMarker
                    compact
                    variant="exclude"
                    readOnly={readOnly}
                    evaluationId={
                      rows
                        .filter(
                          (x) =>
                            x.job_position_id === r.job_position_id &&
                            x.excludeFromAverage,
                        )
                        .map((x) => x.evaluationId)
                        .find(Boolean) ??
                      r.evaluationIds[0] ??
                      null
                    }
                    comment={r.attentionComment}
                    evidence={r.attentionEvidence}
                  />
                ) : r.hasCountedNote ? (
                  <AttentionNoteMarker
                    compact
                    variant="note"
                    readOnly={readOnly}
                    evaluationId={
                      rows
                        .filter(
                          (x) =>
                            x.job_position_id === r.job_position_id &&
                            x.hasCountedNote,
                        )
                        .map((x) => x.evaluationId)
                        .find(Boolean) ??
                      r.evaluationIds[0] ??
                      null
                    }
                    comment={r.attentionComment}
                    evidence={r.attentionEvidence}
                  />
                ) : null}
                <ScoreChip score={r.avgScore} />
                {!readOnly ? (
                  <>
                    <QuickEvaluatePopover
                      positionName={r.positionName}
                      jobPositionId={r.job_position_id}
                      clauseIds={r.clauseIds}
                      responsibilityType={r.primaryType}
                      responsibilityTypes={r.types}
                      defaultScore={r.avgScore}
                    />
                    <EditResponsibilityLinkMenu
                      linkIds={r.linkIds}
                      positionName={r.positionName}
                      responsibilityType={r.primaryType}
                    />
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {showAssign && !readOnly && orgTree ? (
        <div className="rounded border border-[var(--border)] bg-[var(--card)] p-2">
          <div className="mb-2 text-xs font-medium text-[var(--fg)]">
            Ажлын байр холбох
          </div>
          <AssignResponsibilityForm
            policyId={policyId}
            tree={orgTree}
            clauses={clauses}
            sections={sections}
            lockedTarget={lockedAssignTarget}
          />
        </div>
      ) : null}

      {showEval && !readOnly ? (
        <div className="rounded border border-[var(--border)] bg-[var(--card)] p-2">
          <div className="mb-2 text-xs font-medium text-[var(--fg)]">
            Үнэлгээ өгөх
          </div>
          {showPolicyEval ? (
            <PolicyEvaluateForm options={fallbackPolicyEval} />
          ) : clauseId ? (
            <ClauseEvaluateForm clauseId={clauseId} links={evalOptions} />
          ) : (
            <p className="text-xs text-[var(--muted)]">Үнэлэх холбоос байхгүй.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function collectSubtreeLinkRows(
  node: ClauseTreeNode,
  rowsByClause: Map<string, LinkScoreRow[]>,
): LinkScoreRow[] {
  const own = rowsByClause.get(node.id) ?? [];
  if (node.children.length === 0) return own;
  return own.concat(
    ...node.children.map((child) =>
      collectSubtreeLinkRows(child, rowsByClause),
    ),
  );
}

function ClauseNode({
  node,
  depth,
  rowsByClause,
  readOnly,
  policyId,
  orgTree,
  clauses,
  sections,
}: {
  node: ClauseTreeNode;
  depth: number;
  rowsByClause: Map<string, LinkScoreRow[]>;
  readOnly: boolean;
  policyId: string;
  orgTree: OrgAssignTree | null;
  clauses: Array<{
    id: string;
    label: string;
    sectionId?: string | null;
    parentId?: string | null;
  }>;
  sections: Array<{ id: string; label: string }>;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  /** Sub-clauses start collapsed. */
  const [childrenOpen, setChildrenOpen] = useState(false);
  const hasChildren = node.children.length > 0;
  const rows = useMemo(
    () => collectSubtreeLinkRows(node, rowsByClause),
    [node, rowsByClause],
  );
  const kpis = useMemo(() => computeScopeKpis(rows), [rows]);

  return (
    <li className="border-l border-[var(--border)]">
      <div
        className="border-b border-[var(--border)]/60 py-2 pr-2"
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => setChildrenOpen((v) => !v)}
                  aria-expanded={childrenOpen}
                  title={childrenOpen ? "Дэд заалт хаах" : "Дэд заалт нээх"}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--surface-muted)]"
                >
                  {childrenOpen ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </button>
              ) : (
                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-[var(--muted)]">
                  <FileText size={13} />
                </span>
              )}
              {hasChildren ? (
                childrenOpen ? (
                  <FolderOpen size={14} className="shrink-0 text-sky-700 dark:text-sky-300" />
                ) : (
                  <Folder size={14} className="shrink-0 text-[var(--muted)]" />
                )
              ) : null}
              <span className="font-mono text-xs text-[var(--muted)]">
                {node.reference_number || "—"}
              </span>
              <Link
                href={`/clauses/${node.id}`}
                className="min-w-0 text-sm font-medium text-[var(--fg)] hover:underline"
              >
                {truncate(node.text || "(хоосон зүйл)", 160)}
              </Link>
              {hasChildren ? (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] tabular-nums",
                    childrenOpen
                      ? "bg-sky-500/15 text-sky-900 dark:text-sky-100"
                      : "bg-[var(--surface-muted)] text-[var(--muted)]",
                  )}
                  title={childrenOpen ? "Дэд заалт нээлттэй" : "Дэд заалт хаагдсан"}
                >
                  {node.children.length} · {childrenOpen ? "нээлттэй" : "хаагдсан"}
                </span>
              ) : null}
              {kpis.attentionCount > 0 ? (
                <AttentionNoteMarker
                  compact
                  variant="exclude"
                  readOnly={readOnly}
                  evaluationId={
                    rows.find((r) => r.excludeFromAverage)?.evaluationId ?? null
                  }
                  comment={
                    rows.find((r) => r.excludeFromAverage)?.attentionComment ??
                    null
                  }
                  evidence={
                    rows.find((r) => r.excludeFromAverage)?.attentionEvidence ??
                    null
                  }
                />
              ) : kpis.noteCount > 0 ? (
                <AttentionNoteMarker
                  compact
                  variant="note"
                  readOnly={readOnly}
                  evaluationId={
                    rows.find((r) => r.hasCountedNote)?.evaluationId ?? null
                  }
                  comment={
                    rows.find((r) => r.hasCountedNote)?.attentionComment ?? null
                  }
                  evidence={
                    rows.find((r) => r.hasCountedNote)?.attentionEvidence ?? null
                  }
                />
              ) : null}
            </div>
            <div className="mt-1.5 pl-7">
              <ScopeKpiChips
                linkCount={kpis.linkCount}
                positionCount={kpis.positionCount}
                avgScore={kpis.avgScore}
                unevaluatedCount={kpis.unevaluatedCount}
                attentionCount={kpis.attentionCount}
                noteCount={kpis.noteCount}
              />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <IconBtn
              title={panelOpen ? "Цонх хаах" : "Холбоос / үнэлгээ цонх"}
              active={panelOpen}
              onClick={() => setPanelOpen((v) => !v)}
            >
              {panelOpen ? <ChevronDown size={14} /> : <ListChecks size={14} />}
            </IconBtn>
            {!readOnly && rows.length > 0 ? (
              <BulkUnlinkScopeButton
                variant="icon"
                clauseId={node.id}
                label="Зүйлийн бүх холбоосыг салгах"
                confirmLabel={node.reference_number || "Зүйл"}
              />
            ) : null}
          </div>
        </div>

        {panelOpen ? (
          <div className="pl-7">
            <LinksPanel
              rows={rows}
              readOnly={readOnly}
              clauseId={node.id}
              policyId={policyId}
              orgTree={orgTree}
              clauses={clauses}
              sections={sections}
              lockedAssignTarget={node.id}
            />
          </div>
        ) : null}
      </div>

      {hasChildren && childrenOpen ? (
        <ul>
          {node.children.map((child) => (
            <ClauseNode
              key={child.id}
              node={child}
              depth={depth + 1}
              rowsByClause={rowsByClause}
              readOnly={readOnly}
              policyId={policyId}
              orgTree={orgTree}
              clauses={clauses}
              sections={sections}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function PolicyScopeWorkbench({
  policyId,
  policyName,
  readOnly,
  orgTree,
  sections,
  trees,
  clauses,
  linkRows,
  policyEvalOptions,
}: {
  policyId: string;
  policyName: string;
  readOnly: boolean;
  orgTree: OrgAssignTree | null;
  sections: Array<{ id: string; label: string }>;
  trees: Array<{
    section: { id: string; reference_number: string | null; text: string | null };
    tree: ClauseTreeNode[];
  }>;
  clauses: Array<{
    id: string;
    label: string;
    sectionId?: string | null;
    parentId?: string | null;
  }>;
  linkRows: LinkScoreRow[];
  policyEvalOptions: PolicyEvalOption[];
}) {
  const [policyOpen, setPolicyOpen] = useState(false);
  /** LinksPanel open per section (assign/eval). */
  const [panelOpenSections, setPanelOpenSections] = useState<Set<string>>(
    () => new Set(),
  );
  /** Clause tree open per section — starts collapsed. */
  const [treeOpenSections, setTreeOpenSections] = useState<Set<string>>(
    () => new Set(),
  );

  const rowsByClause = useMemo(() => {
    const map = new Map<string, LinkScoreRow[]>();
    for (const r of linkRows) {
      const list = map.get(r.policy_clause_id) ?? [];
      list.push(r);
      map.set(r.policy_clause_id, list);
    }
    return map;
  }, [linkRows]);

  const policyKpis = useMemo(() => computeScopeKpis(linkRows), [linkRows]);

  const sectionRowsMap = useMemo(() => {
    const clauseSection = new Map(
      clauses.map((c) => [c.id, c.sectionId ?? null] as const),
    );
    const map = new Map<string, LinkScoreRow[]>();
    for (const r of linkRows) {
      const sid = clauseSection.get(r.policy_clause_id);
      const key = sid ?? "__orphan__";
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    }
    return map;
  }, [linkRows, clauses]);

  function toggleSet(prev: Set<string>, id: string) {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  const sectionEvalOptions = useMemo(() => {
    const map = new Map<string, PolicyEvalOption[]>();
    for (const s of sections) {
      map.set(
        s.id,
        policyEvalOptions.filter((o) => o.id.startsWith(`section:${s.id}::`)),
      );
    }
    return map;
  }, [sections, policyEvalOptions]);

  const policyOnlyEval = useMemo(
    () => policyEvalOptions.filter((o) => o.id.startsWith("policy::")),
    [policyEvalOptions],
  );

  return (
    <div className="space-y-2">
      <div className="rounded border border-[var(--border)] bg-[var(--card)] p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Журам
            </div>
            <div className="text-sm font-medium text-[var(--fg)]">
              {policyName}
            </div>
            <div className="mt-1.5">
              <ScopeKpiChips
                linkCount={policyKpis.linkCount}
                positionCount={policyKpis.positionCount}
                avgScore={policyKpis.avgScore}
                unevaluatedCount={policyKpis.unevaluatedCount}
                attentionCount={policyKpis.attentionCount}
                noteCount={policyKpis.noteCount}
              />
            </div>
            <div className="mt-2">
              <ScopeKpiLegend />
            </div>
          </div>
          <div className="flex items-center gap-1">
            <IconBtn
              title={policyOpen ? "Цонх хаах" : "Журмын холбоос / үнэлгээ"}
              active={policyOpen}
              onClick={() => setPolicyOpen((v) => !v)}
            >
              {policyOpen ? <ChevronDown size={14} /> : <ListChecks size={14} />}
            </IconBtn>
            {!readOnly && linkRows.length > 0 ? (
              <BulkUnlinkScopeButton
                variant="icon"
                policyId={policyId}
                label="Журмын бүх холбоосыг салгах"
                confirmLabel={policyName}
              />
            ) : null}
          </div>
        </div>
        {policyOpen ? (
          <LinksPanel
            rows={linkRows}
            readOnly={readOnly}
            policyId={policyId}
            orgTree={orgTree}
            clauses={clauses}
            sections={sections}
            lockedAssignTarget="__policy__"
            showPolicyEval
            policyEvalOptions={policyOnlyEval}
          />
        ) : null}
      </div>

      {trees.map(({ section, tree }) => {
        const sectionKey =
          section.id === "orphan" ? "__orphan__" : section.id;
        const sRows = sectionRowsMap.get(sectionKey) ?? [];
        const sKpis = computeScopeKpis(sRows);
        const panelOpen = panelOpenSections.has(section.id);
        const treeOpen = treeOpenSections.has(section.id);
        const title =
          `Хэсэг ${section.reference_number || ""} ${section.text || ""}`.trim();
        const topClauseCount = tree.length;
        return (
          <section
            key={section.id}
            className="overflow-hidden rounded border border-[var(--border)] bg-[var(--card)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-2 px-2 py-2">
              <button
                type="button"
                onClick={() =>
                  setTreeOpenSections((prev) => toggleSet(prev, section.id))
                }
                aria-expanded={treeOpen}
                className="flex min-w-0 flex-1 items-start gap-1.5 rounded px-1 py-0.5 text-left hover:bg-[var(--surface-muted)]"
              >
                <span className="mt-0.5 shrink-0 text-[var(--muted)]">
                  {treeOpen ? (
                    <ChevronDown size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </span>
                <span className="mt-0.5 shrink-0 text-[var(--muted)]">
                  {treeOpen ? (
                    <FolderOpen size={15} className="text-sky-700 dark:text-sky-300" />
                  ) : (
                    <Folder size={15} />
                  )}
                </span>
                <div className="min-w-0">
                  <h2 className="text-sm font-semibold text-[var(--fg)]">
                    {title}
                  </h2>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <ScopeKpiChips
                      linkCount={sKpis.linkCount}
                      positionCount={sKpis.positionCount}
                      avgScore={sKpis.avgScore}
                      unevaluatedCount={sKpis.unevaluatedCount}
                      attentionCount={sKpis.attentionCount}
                      noteCount={sKpis.noteCount}
                    />
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] tabular-nums",
                        treeOpen
                          ? "bg-sky-500/15 text-sky-900 dark:text-sky-100"
                          : "bg-[var(--surface-muted)] text-[var(--muted)]",
                      )}
                    >
                      {topClauseCount} зүйл ·{" "}
                      {treeOpen ? "нээлттэй" : "хаагдсан"}
                    </span>
                  </div>
                </div>
              </button>
              <div className="flex items-center gap-1 pr-1">
                <IconBtn
                  title={panelOpen ? "Цонх хаах" : "Хэсгийн холбоос / үнэлгээ"}
                  active={panelOpen}
                  onClick={() =>
                    setPanelOpenSections((prev) => toggleSet(prev, section.id))
                  }
                >
                  {panelOpen ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ListChecks size={14} />
                  )}
                </IconBtn>
                {!readOnly &&
                section.id !== "orphan" &&
                sRows.length > 0 ? (
                  <BulkUnlinkScopeButton
                    variant="icon"
                    policyId={policyId}
                    sectionId={section.id}
                    label="Хэсгийн холбоосыг бүгдийг салгах"
                    confirmLabel={title}
                  />
                ) : null}
              </div>
            </div>
            {panelOpen ? (
              <div className="border-t border-[var(--border)] px-3 pb-2 pt-1">
                <LinksPanel
                  rows={sRows}
                  readOnly={readOnly}
                  policyId={policyId}
                  orgTree={orgTree}
                  clauses={clauses}
                  sections={sections}
                  lockedAssignTarget={
                    section.id === "orphan"
                      ? undefined
                      : `__section__:${section.id}`
                  }
                  showPolicyEval
                  policyEvalOptions={
                    sectionEvalOptions.get(section.id) ?? []
                  }
                />
              </div>
            ) : null}
            {treeOpen ? (
              <div className="border-t border-[var(--border)] p-2">
                {tree.length === 0 ? (
                  <p className="px-2 py-1 text-sm text-[var(--muted)]">
                    Энэ хэсэгт зүйл заалт байхгүй.
                  </p>
                ) : (
                  <ul className="text-sm">
                    {tree.map((node) => (
                      <ClauseNode
                        key={node.id}
                        node={node}
                        depth={0}
                        rowsByClause={rowsByClause}
                        readOnly={readOnly}
                        policyId={policyId}
                        orgTree={orgTree}
                        clauses={clauses}
                        sections={sections}
                      />
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

/** Keep ClauseTree export for any other callers — thin wrapper. */
export function ClauseTree({
  tree,
  positionNames,
  scores,
}: {
  tree: ClauseTreeNode[];
  positionNames: Map<string, string>;
  scores?: Map<string, number>;
}) {
  const rowsByClause = useMemo(() => {
    const map = new Map<string, LinkScoreRow[]>();
    const scoreMap = scores ?? new Map();
    function walk(nodes: ClauseTreeNode[]) {
      for (const n of nodes) {
        const rows: LinkScoreRow[] = n.responsibilities.map((r) => ({
          id: r.id,
          policy_clause_id: r.policy_clause_id,
          job_position_id: r.job_position_id,
          responsibility_type: r.responsibility_type,
          positionName:
            positionNames.get(r.job_position_id) ?? r.job_position_id,
          score:
            scoreMap.get(
              `${r.policy_clause_id}:${r.job_position_id}:${r.responsibility_type}`,
            ) ?? null,
          notes: r.notes,
        }));
        map.set(n.id, rows);
        if (n.children.length) walk(n.children);
      }
    }
    walk(tree);
    return map;
  }, [tree, positionNames, scores]);

  if (!tree.length) {
    return (
      <p className="text-sm text-slate-500">Энэ хэсэгт зүйл заалт байхгүй.</p>
    );
  }

  return (
    <ul className="text-sm">
      {tree.map((node) => (
        <ClauseNode
          key={node.id}
          node={node}
          depth={0}
          rowsByClause={rowsByClause}
          readOnly
          policyId=""
          orgTree={null}
          clauses={[]}
          sections={[]}
        />
      ))}
    </ul>
  );
}
