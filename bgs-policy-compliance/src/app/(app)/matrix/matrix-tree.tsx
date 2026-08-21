"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen } from "lucide-react";
import { Badge, ScoreChip } from "@/components/ui/primitives";
import { RESPONSIBILITY_LABELS, responsibilityTone } from "@/lib/constants";
import type {
  ClausePositionResponsibility,
  ComplianceEvaluation,
  JobPosition,
  Policy,
  PolicyClause,
} from "@/lib/types";
import { cn, truncate } from "@/lib/utils";

export type MatrixRow = {
  link: ClausePositionResponsibility;
  clause?: PolicyClause;
  policy?: Policy;
  position?: JobPosition;
  evaluation: ComplianceEvaluation | null;
};

type ClauseGroup = {
  key: string;
  label: string;
  ref: string;
  clauseId: string | null;
  rows: MatrixRow[];
};

type PolicyGroup = {
  key: string;
  label: string;
  code: string | null;
  policyId: string | null;
  clauses: ClauseGroup[];
  count: number;
};

function buildTree(rows: MatrixRow[]): PolicyGroup[] {
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
        label: clauseText,
        ref,
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
        (a.position?.name ?? "").localeCompare(b.position?.name ?? "", "mn"),
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
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  meta?: string | null;
  count: number;
  depth: number;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100",
        depth === 0 && "bg-slate-100 font-semibold",
        depth === 1 && "bg-slate-50 font-medium text-slate-800",
      )}
      style={{ paddingLeft: 8 + depth * 16 }}
    >
      {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      {open ? (
        <FolderOpen size={16} className="text-orange-500" />
      ) : (
        <Folder size={16} className="text-slate-400" />
      )}
      <span className="min-w-0 flex-1 truncate">
        {label}
        {meta ? (
          <span className="ml-2 font-mono text-xs font-normal text-slate-500">
            {meta}
          </span>
        ) : null}
      </span>
      <span className="tabular-nums text-xs text-slate-500">{count}</span>
    </button>
  );
}

export function MatrixTree({ rows }: { rows: MatrixRow[] }) {
  const limited = useMemo(() => rows.slice(0, 2000), [rows]);
  const tree = useMemo(() => buildTree(limited), [limited]);
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
          Бүгдийг хаах
        </button>
      </div>

      <div className="max-h-[640px] overflow-auto rounded border border-slate-200">
        <div className="min-w-[800px]">
          {tree.map((policy) => {
            const policyOpen = openPolicies.has(policy.key);
            return (
              <div key={policy.key} className="border-b border-slate-100 last:border-b-0">
                <FolderHeader
                  open={policyOpen}
                  onToggle={() => togglePolicy(policy.key)}
                  label={truncate(policy.label, 80)}
                  meta={policy.code}
                  count={policy.count}
                  depth={0}
                />
                {policyOpen
                  ? policy.clauses.map((clause) => {
                      const clauseOpen = openClauses.has(clause.key);
                      return (
                        <div key={clause.key}>
                          <FolderHeader
                            open={clauseOpen}
                            onToggle={() => toggleClause(clause.key)}
                            label={`${clause.ref} · ${truncate(clause.label, 70)}`}
                            count={clause.rows.length}
                            depth={1}
                          />
                          {clauseOpen ? (
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-sm">
                                <thead className="border-y border-slate-200 bg-white text-xs uppercase text-slate-500">
                                  <tr>
                                    <th className="py-1.5 pl-12 pr-2">Ажлын байр</th>
                                    <th className="py-1.5 pr-2">Үүрэг</th>
                                    <th className="py-1.5 pr-2">Оноо</th>
                                    <th className="py-1.5 pr-2">Үнэлэх</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {clause.rows.map((r) => (
                                    <tr
                                      key={r.link.id}
                                      className="border-b border-slate-50"
                                    >
                                      <td className="py-1.5 pl-12 pr-2">
                                        {r.position?.id ? (
                                          <Link
                                            href={`/positions/${r.position.id}`}
                                            className="hover:underline"
                                          >
                                            {truncate(r.position.name ?? "", 50)}
                                          </Link>
                                        ) : (
                                          "—"
                                        )}
                                      </td>
                                      <td className="py-1.5 pr-2">
                                        <Badge
                                          className={responsibilityTone(
                                            r.link.responsibility_type,
                                          )}
                                        >
                                          {
                                            RESPONSIBILITY_LABELS[
                                              r.link.responsibility_type
                                            ]
                                          }
                                        </Badge>
                                      </td>
                                      <td className="py-1.5 pr-2">
                                        <ScoreChip score={r.evaluation?.score} />
                                      </td>
                                      <td className="py-1.5 pr-2">
                                        {r.clause?.id ? (
                                          <Link
                                            href={`/clauses/${r.clause.id}`}
                                            className="text-xs font-medium text-orange-600 hover:underline"
                                          >
                                            Үнэлэх
                                          </Link>
                                        ) : (
                                          "—"
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : null}
                        </div>
                      );
                    })
                  : null}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Харуулж буй {Math.min(rows.length, 2000)} / {rows.length} холбоос ·{" "}
        {tree.length} журам
      </p>
    </div>
  );
}
