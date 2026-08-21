"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen } from "lucide-react";
import { Badge, ScoreChip } from "@/components/ui/primitives";
import { RESPONSIBILITY_LABELS, responsibilityTone } from "@/lib/constants";
import type {
  ClausePositionResponsibility,
  ComplianceEvaluation,
  Policy,
  PolicyClause,
  ResponsibilityType,
} from "@/lib/types";
import { cn, truncate } from "@/lib/utils";

export type ObligationRow = {
  link: ClausePositionResponsibility;
  clause?: PolicyClause | null;
  policy?: Policy | null;
  evaluation?: ComplianceEvaluation | null;
};

type ClauseGroup = {
  key: string;
  ref: string;
  label: string;
  clauseId: string | null;
  rows: ObligationRow[];
};

type PolicyGroup = {
  key: string;
  label: string;
  code: string | null;
  policyId: string | null;
  clauses: ClauseGroup[];
  count: number;
};

function buildTree(rows: ObligationRow[]): PolicyGroup[] {
  const byPolicy = new Map<
    string,
    {
      label: string;
      code: string | null;
      policyId: string | null;
      byClause: Map<string, ClauseGroup>;
    }
  >();

  for (const r of rows) {
    const policyId = r.policy?.id ?? "__none__";
    const policyLabel = r.policy?.name?.trim() || "Ангилагдаагүй журам";
    const code = r.policy?.reference_code ?? null;
    if (!byPolicy.has(policyId)) {
      byPolicy.set(policyId, {
        label: policyLabel,
        code,
        policyId: r.policy?.id ?? null,
        byClause: new Map(),
      });
    }
    const pg = byPolicy.get(policyId)!;
    const clauseId = r.clause?.id ?? "__none__";
    const ref = r.clause?.reference_number?.trim() || "—";
    const clauseText = r.clause?.text?.trim() || "Зүйлгүй";
    if (!pg.byClause.has(clauseId)) {
      pg.byClause.set(clauseId, {
        key: `${policyId}::${clauseId}`,
        ref,
        label: clauseText,
        clauseId: r.clause?.id ?? null,
        rows: [],
      });
    }
    pg.byClause.get(clauseId)!.rows.push(r);
  }

  const groups: PolicyGroup[] = [];
  for (const [key, pg] of byPolicy) {
    const clauses = [...pg.byClause.values()].sort((a, b) =>
      a.ref.localeCompare(b.ref, "mn", { numeric: true }),
    );
    for (const c of clauses) {
      c.rows.sort((a, b) =>
        a.link.responsibility_type.localeCompare(b.link.responsibility_type),
      );
    }
    groups.push({
      key,
      label: pg.label,
      code: pg.code,
      policyId: pg.policyId,
      clauses,
      count: clauses.reduce((n, c) => n + c.rows.length, 0),
    });
  }

  return groups.sort((a, b) => a.label.localeCompare(b.label, "mn"));
}

function FolderHeader({
  open,
  onToggle,
  label,
  meta,
  count,
  depth,
  href,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  meta?: string | null;
  count: number;
  depth: number;
  href?: string | null;
}) {
  return (
    <div
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm",
        depth === 0 && "bg-slate-100 font-semibold",
        depth === 1 && "bg-slate-50 font-medium text-slate-800",
      )}
      style={{ paddingLeft: 8 + depth * 16 }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex min-w-0 flex-1 items-center gap-2 text-left hover:opacity-90"
      >
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {open ? (
          <FolderOpen size={16} className="shrink-0 text-orange-500" />
        ) : (
          <Folder size={16} className="shrink-0 text-slate-400" />
        )}
        <span className="min-w-0 flex-1 truncate">
          {href ? (
            <Link href={href} className="hover:underline" onClick={(e) => e.stopPropagation()}>
              {label}
            </Link>
          ) : (
            label
          )}
          {meta ? (
            <span className="ml-2 font-mono text-xs font-normal text-slate-500">
              {meta}
            </span>
          ) : null}
        </span>
        <span className="tabular-nums text-xs font-normal text-slate-500">
          {count}
        </span>
      </button>
    </div>
  );
}

export function PositionObligationsTree({ rows }: { rows: ObligationRow[] }) {
  const tree = useMemo(() => buildTree(rows), [rows]);
  const [openPolicies, setOpenPolicies] = useState<Set<string>>(() => new Set());
  const [openClauses, setOpenClauses] = useState<Set<string>>(() => new Set());

  function togglePolicy(key: string) {
    setOpenPolicies((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleClause(key: string) {
    setOpenClauses((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function expandAll() {
    setOpenPolicies(new Set(tree.map((p) => p.key)));
    setOpenClauses(new Set(tree.flatMap((p) => p.clauses.map((c) => c.key))));
  }

  function collapseAll() {
    setOpenPolicies(new Set());
    setOpenClauses(new Set());
  }

  if (!rows.length) {
    return <p className="text-sm text-slate-500">Холбоос байхгүй.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 text-xs">
        <button
          type="button"
          onClick={expandAll}
          className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50"
        >
          Бүгдийг нээх
        </button>
        <button
          type="button"
          onClick={collapseAll}
          className="rounded border border-slate-300 bg-white px-2 py-1 hover:bg-slate-50"
        >
          Бүгдийг хураах
        </button>
      </div>

      <div className="max-h-[520px] overflow-auto rounded border border-slate-200">
        <div className="min-w-[720px]">
          <div className="sticky top-0 z-10 grid grid-cols-[1fr_140px_100px] gap-2 border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-xs uppercase text-slate-500">
            <div>Журам / Зүйл</div>
            <div>Үүрэг</div>
            <div>Сүүлд</div>
          </div>

          {tree.map((policy) => {
            const policyOpen = openPolicies.has(policy.key);
            return (
              <div
                key={policy.key}
                className="border-b border-slate-100 last:border-b-0"
              >
                <FolderHeader
                  open={policyOpen}
                  onToggle={() => togglePolicy(policy.key)}
                  label={truncate(policy.label, 70)}
                  meta={policy.code}
                  count={policy.count}
                  depth={0}
                  href={
                    policy.policyId ? `/policies/${policy.policyId}` : null
                  }
                />
                {policyOpen
                  ? policy.clauses.map((clause) => {
                      const clauseOpen = openClauses.has(clause.key);
                      return (
                        <div key={clause.key}>
                          <FolderHeader
                            open={clauseOpen}
                            onToggle={() => toggleClause(clause.key)}
                            label={truncate(clause.label, 70)}
                            meta={clause.ref}
                            count={clause.rows.length}
                            depth={1}
                            href={
                              clause.clauseId
                                ? `/clauses/${clause.clauseId}`
                                : null
                            }
                          />
                          {clauseOpen
                            ? clause.rows.map(({ link, evaluation }) => (
                                <div
                                  key={link.id}
                                  className="grid grid-cols-[1fr_140px_100px] gap-2 border-t border-slate-50 px-2 py-1.5 text-sm hover:bg-slate-50"
                                  style={{ paddingLeft: 40 }}
                                >
                                  <div className="text-xs text-slate-500">
                                    {RESPONSIBILITY_LABELS[
                                      link.responsibility_type as ResponsibilityType
                                    ] || link.responsibility_type}{" "}
                                    үүрэг
                                  </div>
                                  <div>
                                    <Badge
                                      className={responsibilityTone(
                                        link.responsibility_type,
                                      )}
                                    >
                                      {
                                        RESPONSIBILITY_LABELS[
                                          link.responsibility_type
                                        ]
                                      }
                                    </Badge>
                                  </div>
                                  <div>
                                    <ScoreChip score={evaluation?.score} />
                                  </div>
                                </div>
                              ))
                            : null}
                        </div>
                      );
                    })
                  : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
