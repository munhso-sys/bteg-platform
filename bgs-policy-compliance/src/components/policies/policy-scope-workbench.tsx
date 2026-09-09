"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  Link2,
  ListChecks,
  Plus,
  Star,
} from "lucide-react";
import { Badge, ScoreChip } from "@/components/ui/primitives";
import {
  RESPONSIBILITY_LABELS,
  RESPONSIBILITY_SHORT,
  responsibilityTone,
} from "@/lib/constants";
import {
  computeScopeKpis,
  sortLinksByScoreAsc,
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

function ScopeKpiChips({
  linkCount,
  positionCount,
  avgScore,
  unevaluatedCount,
}: {
  linkCount: number;
  positionCount: number;
  avgScore: number | null;
  unevaluatedCount: number;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
      <span
        className="inline-flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--surface-muted)] px-1.5 py-0.5 tabular-nums text-[var(--fg)]"
        title="Холбоос (үүргийн төрөлтэй)"
      >
        <Link2 size={12} className="text-[var(--muted)]" />
        {linkCount}
        <span className="text-[var(--muted)]">холбоос</span>
      </span>
      <span
        className="inline-flex items-center gap-1 rounded border border-[var(--border)] bg-[var(--surface-muted)] px-1.5 py-0.5 tabular-nums text-[var(--fg)]"
        title="Өөр ажлын байр"
      >
        {positionCount}
        <span className="text-[var(--muted)]">байр</span>
      </span>
      <span
        className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 tabular-nums text-amber-200"
        title="Дундаж үнэлгээ"
      >
        ⌀ {avgScore != null ? avgScore : "—"}
      </span>
      {unevaluatedCount > 0 ? (
        <span
          className="inline-flex items-center gap-1 rounded border border-rose-500/40 bg-rose-500/15 px-1.5 py-0.5 tabular-nums text-rose-200"
          title="Үнэлгээ өгөөгүй холбоос"
        >
          {unevaluatedCount}
          <span className="text-rose-300/90">үнэлгээгүй</span>
        </span>
      ) : linkCount > 0 ? (
        <span className="inline-flex items-center rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">
          бүрэн
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
          ? "border-orange-400/60 bg-orange-500/15 text-orange-200"
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
  clauses: Array<{ id: string; label: string; sectionId?: string | null }>;
  sections: Array<{ id: string; label: string }>;
  policyEvalOptions?: PolicyEvalOption[];
  lockedAssignTarget?: string;
  showPolicyEval?: boolean;
}) {
  const [showAssign, setShowAssign] = useState(false);
  const [showEval, setShowEval] = useState(false);
  const sorted = useMemo(() => sortLinksByScoreAsc(rows), [rows]);
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
                  ? "border-orange-400/60 bg-orange-500/15 text-orange-200"
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
                  ? "border-orange-400/60 bg-orange-500/15 text-orange-200"
                  : "border-[var(--border)] bg-[var(--card)] text-[var(--fg)]",
              )}
            >
              <Star size={12} />
              Үнэлгээ өгөх
            </button>
          </div>
        ) : null}
      </div>

      {sorted.length === 0 ? (
        <p className="px-1 py-2 text-xs text-[var(--muted)]">
          Холбоос байхгүй. «Ажлын байр холбох»-оор нэмнэ үү.
        </p>
      ) : (
        <ul className="max-h-56 space-y-0.5 overflow-auto rounded border border-[var(--border)] bg-[var(--card)] text-sm">
          {sorted.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-2 py-1.5 last:border-b-0"
            >
              <div className="min-w-0">
                {readOnly ? (
                  <span className="truncate">{r.positionName}</span>
                ) : (
                  <Link
                    href={`/positions/${r.job_position_id}`}
                    className="truncate hover:underline"
                  >
                    {r.positionName}
                  </Link>
                )}
                <div className="mt-0.5">
                  <Badge
                    className={cn(
                      "text-[10px]",
                      responsibilityTone(r.responsibility_type),
                    )}
                  >
                    {RESPONSIBILITY_SHORT[r.responsibility_type]}
                  </Badge>
                </div>
              </div>
              <ScoreChip score={r.score} />
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
  clauses: Array<{ id: string; label: string; sectionId?: string | null }>;
  sections: Array<{ id: string; label: string }>;
}) {
  const [open, setOpen] = useState(false);
  const rows = rowsByClause.get(node.id) ?? [];
  const kpis = useMemo(() => computeScopeKpis(rows), [rows]);

  return (
    <li className="border-l border-slate-200">
      <div
        className="border-b border-slate-100 py-2 pr-2"
        style={{ paddingLeft: `${depth * 14 + 8}px` }}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-slate-500">
                {node.reference_number || "—"}
              </span>
              <Link
                href={`/clauses/${node.id}`}
                className="text-sm font-medium text-[var(--fg)] hover:underline"
              >
                {truncate(node.text || "(хоосон зүйл)", 160)}
              </Link>
            </div>
            <div className="mt-1.5">
              <ScopeKpiChips
                linkCount={kpis.linkCount}
                positionCount={kpis.positionCount}
                avgScore={kpis.avgScore}
                unevaluatedCount={kpis.unevaluatedCount}
              />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <IconBtn
              title={open ? "Цонх хаах" : "Холбоос / үнэлгээ цонх"}
              active={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <ChevronDown size={14} /> : <ListChecks size={14} />}
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

        {open ? (
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
        ) : null}
      </div>

      {node.children.length > 0 ? (
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
  clauses: Array<{ id: string; label: string; sectionId?: string | null }>;
  linkRows: LinkScoreRow[];
  policyEvalOptions: PolicyEvalOption[];
}) {
  const [policyOpen, setPolicyOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set());

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

  function toggleSection(id: string) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
    <div className="space-y-3">
      <div className="rounded border border-[var(--border)] bg-[var(--card)] p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
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
              />
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
        const isOpen = openSections.has(section.id);
        const title =
          `Хэсэг ${section.reference_number || ""} ${section.text || ""}`.trim();
        return (
          <section
            key={section.id}
            className="overflow-hidden rounded border border-[var(--border)] bg-[var(--card)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 px-3 py-2">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-[var(--fg)]">{title}</h2>
                <div className="mt-1">
                  <ScopeKpiChips
                    linkCount={sKpis.linkCount}
                    positionCount={sKpis.positionCount}
                    avgScore={sKpis.avgScore}
                    unevaluatedCount={sKpis.unevaluatedCount}
                  />
                </div>
              </div>
              <div className="flex items-center gap-1">
                <IconBtn
                  title={isOpen ? "Цонх хаах" : "Хэсгийн холбоос / үнэлгээ"}
                  active={isOpen}
                  onClick={() => toggleSection(section.id)}
                >
                  {isOpen ? (
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
            {isOpen ? (
              <div className="border-b border-slate-100 px-3 pb-2">
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
            <div className="p-2">
              {tree.length === 0 ? (
                <p className="px-2 py-1 text-sm text-slate-500">
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
