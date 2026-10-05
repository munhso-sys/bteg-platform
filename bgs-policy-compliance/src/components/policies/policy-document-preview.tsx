"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import type { ClauseTreeNode } from "@/lib/types";
import {
  clauseHeading,
  sectionHeading,
  type PolicyDocumentModel,
} from "@/lib/policy-document";
import { cn } from "@/lib/utils";

function ClausePreview({
  node,
  depth,
}: {
  node: ClauseTreeNode;
  depth: number;
}) {
  return (
    <div
      className="border-l border-[var(--border)]/70 py-2"
      style={{ paddingLeft: `${depth * 14 + 8}px` }}
    >
      <div className="flex items-start gap-2">
        <FileText size={14} className="mt-0.5 shrink-0 text-[var(--muted)]" />
        <div className="min-w-0 flex-1">
          <div className="font-mono text-xs text-[var(--muted)]">
            {clauseHeading(node)}
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[var(--fg)]">
            {node.text || "(хоосон зүйл)"}
          </p>
        </div>
      </div>
      {node.children?.length ? (
        <div className="mt-1">
          {node.children.map((child) => (
            <ClausePreview key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function countClauses(nodes: ClauseTreeNode[]): number {
  let n = 0;
  for (const node of nodes) {
    n += 1;
    if (node.children?.length) n += countClauses(node.children);
  }
  return n;
}

function SectionBlock({
  heading,
  clauses,
  defaultOpen,
}: {
  heading: string;
  clauses: ClauseTreeNode[];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const total = countClauses(clauses);
  return (
    <section className="rounded border border-[var(--border)] bg-[var(--card)]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-[var(--surface-muted)]/50"
      >
        {open ? (
          <ChevronDown size={16} className="shrink-0 text-[var(--muted)]" />
        ) : (
          <ChevronRight size={16} className="shrink-0 text-[var(--muted)]" />
        )}
        {open ? (
          <FolderOpen size={16} className="shrink-0 text-sky-700 dark:text-sky-300" />
        ) : (
          <Folder size={16} className="shrink-0 text-[var(--muted)]" />
        )}
        <span className="min-w-0 flex-1 text-sm font-semibold text-[var(--fg)]">
          {heading}
        </span>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] tabular-nums",
            open
              ? "bg-sky-500/15 text-sky-900 dark:text-sky-100"
              : "bg-[var(--surface-muted)] text-[var(--muted)]",
          )}
        >
          {total} · {open ? "нээлттэй" : "хаагдсан"}
        </span>
      </button>
      {open ? (
        <div className="border-t border-[var(--border)] px-2 pb-2 pt-1">
          {clauses.length === 0 ? (
            <p className="px-2 py-3 text-sm text-[var(--muted)]">
              Зүйл байхгүй.
            </p>
          ) : (
            clauses.map((n) => (
              <ClausePreview key={n.id} node={n} depth={0} />
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}

/** Read-only full-text policy preview. Sections collapse; clauses show full context. */
export function PolicyDocumentPreview({ model }: { model: PolicyDocumentModel }) {
  const { policy, sections } = model;
  return (
    <article className="space-y-3">
      <header className="rounded border border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <div className="text-[11px] uppercase tracking-wide text-[var(--muted)]">
          Журам · бүрэн эх
        </div>
        <h1 className="mt-1 text-lg font-semibold text-[var(--fg)]">
          {policy.name}
        </h1>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--muted)]">
          {policy.reference_code ? <span>Код: {policy.reference_code}</span> : null}
          {policy.version != null ? <span>Хувилбар: {policy.version}</span> : null}
          {policy.approved_date ? (
            <span>Батлагдсан: {policy.approved_date}</span>
          ) : null}
        </div>
      </header>

      {sections.map((block, i) => (
        <SectionBlock
          key={block.section.id}
          heading={sectionHeading(block.section)}
          clauses={block.clauses}
          defaultOpen={i === 0}
        />
      ))}
    </article>
  );
}
