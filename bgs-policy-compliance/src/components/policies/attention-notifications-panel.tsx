"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Folder,
  MessageSquareText,
} from "lucide-react";
import { truncate, cn } from "@/lib/utils";

export type AttentionFeedItem = {
  evaluationId: string;
  policyId: string;
  policyName: string;
  sectionId?: string;
  sectionLabel?: string;
  clauseId: string;
  clauseRef: string | null;
  clauseText: string;
  positionName: string;
  comment: string | null;
  evidence: string | null;
  score: number;
  href: string;
  evaluatedAt: string;
};

type ClauseBucket = {
  clauseId: string;
  clauseRef: string | null;
  clauseText: string;
  items: AttentionFeedItem[];
};

type SectionBucket = {
  sectionId: string;
  sectionLabel: string;
  clauses: ClauseBucket[];
};

type PolicyBucket = {
  policyId: string;
  policyName: string;
  href: string;
  sections: SectionBucket[];
  count: number;
};

function groupByPolicyTree(items: AttentionFeedItem[]): PolicyBucket[] {
  const byPolicy = new Map<
    string,
    {
      policyId: string;
      policyName: string;
      href: string;
      sections: Map<
        string,
        {
          sectionId: string;
          sectionLabel: string;
          clauses: Map<string, ClauseBucket>;
        }
      >;
    }
  >();

  for (const item of items) {
    let policy = byPolicy.get(item.policyId);
    if (!policy) {
      policy = {
        policyId: item.policyId,
        policyName: item.policyName,
        href: item.href,
        sections: new Map(),
      };
      byPolicy.set(item.policyId, policy);
    }
    const sectionId = item.sectionId || "__orphan__";
    const sectionLabel = item.sectionLabel || "Хэсэггүй";
    let section = policy.sections.get(sectionId);
    if (!section) {
      section = {
        sectionId,
        sectionLabel,
        clauses: new Map(),
      };
      policy.sections.set(sectionId, section);
    }
    let clause = section.clauses.get(item.clauseId);
    if (!clause) {
      clause = {
        clauseId: item.clauseId,
        clauseRef: item.clauseRef,
        clauseText: item.clauseText,
        items: [],
      };
      section.clauses.set(item.clauseId, clause);
    }
    clause.items.push(item);
  }

  return [...byPolicy.values()]
    .map((p) => {
      const sections = [...p.sections.values()].map((s) => ({
        sectionId: s.sectionId,
        sectionLabel: s.sectionLabel,
        clauses: [...s.clauses.values()].sort((a, b) =>
          (a.clauseRef || "").localeCompare(b.clauseRef || "", "mn"),
        ),
      }));
      const count = sections.reduce(
        (n, s) => n + s.clauses.reduce((m, c) => m + c.items.length, 0),
        0,
      );
      return {
        policyId: p.policyId,
        policyName: p.policyName,
        href: p.href,
        sections,
        count,
      };
    })
    .sort((a, b) => a.policyName.localeCompare(b.policyName, "mn"));
}

function LeafItem({
  item,
  tone,
}: {
  item: AttentionFeedItem;
  tone: "urgent" | "note";
}) {
  const metaClass =
    tone === "urgent"
      ? "text-amber-900/80 dark:text-amber-100/80"
      : "text-sky-900/80 dark:text-sky-100/80";
  const bodyClass =
    tone === "urgent"
      ? "text-amber-950/90 dark:text-amber-50/90"
      : "text-sky-950/90 dark:text-sky-50/90";

  return (
    <li className="border-l border-[var(--border)] py-1.5 pl-3">
      <div className={cn("text-[11px]", metaClass)}>
        {item.positionName} · оноо {item.score}
        {tone === "urgent" ? " · дундажаас хассан" : " · дундажид орно"}
      </div>
      {item.comment?.trim() ? (
        <p className={cn("mt-0.5 text-xs", bodyClass)}>
          {truncate(item.comment, 140)}
        </p>
      ) : null}
    </li>
  );
}

function FolderRow({
  open,
  onToggle,
  label,
  count,
  href,
  depth,
  tone,
}: {
  open: boolean;
  onToggle: () => void;
  label: string;
  count: number;
  href?: string;
  depth: number;
  tone: "urgent" | "note";
}) {
  const labelClass =
    tone === "urgent"
      ? "text-amber-950 dark:text-amber-50"
      : "text-sky-950 dark:text-sky-50";
  const countClass =
    tone === "urgent"
      ? "bg-amber-500/20 text-amber-950 dark:text-amber-50"
      : "bg-sky-500/20 text-sky-950 dark:text-sky-50";

  return (
    <div
      className="flex items-center gap-1.5 py-1"
      style={{ paddingLeft: `${depth * 12}px` }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex h-6 w-6 items-center justify-center rounded text-[var(--muted)] hover:bg-[var(--surface-muted)]"
        aria-expanded={open}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      <Folder size={14} className="shrink-0 text-[var(--muted)]" />
      {href ? (
        <Link href={href} className={cn("min-w-0 truncate text-sm font-medium hover:underline", labelClass)}>
          {label}
        </Link>
      ) : (
        <span className={cn("min-w-0 truncate text-sm font-medium", labelClass)}>
          {label}
        </span>
      )}
      <span
        className={cn(
          "ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
          countClass,
        )}
      >
        {count}
      </span>
    </div>
  );
}

function AttentionTree({
  items,
  tone,
  defaultOpen,
}: {
  items: AttentionFeedItem[];
  tone: "urgent" | "note";
  defaultOpen?: boolean;
}) {
  const tree = useMemo(() => groupByPolicyTree(items), [items]);
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!defaultOpen) return;
    setOpenKeys(new Set(tree.map((p) => `p:${p.policyId}`)));
  }, [defaultOpen, tree]);

  function toggle(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (!tree.length) {
    return (
      <p className="px-3 py-3 text-sm text-[var(--muted)]">Мөр байхгүй.</p>
    );
  }

  return (
    <div className="max-h-96 overflow-auto px-2 py-1">
      {tree.map((policy) => {
        const pKey = `p:${policy.policyId}`;
        const pOpen = openKeys.has(pKey);
        return (
          <div key={policy.policyId} className="mb-1">
            <FolderRow
              open={pOpen}
              onToggle={() => toggle(pKey)}
              label={policy.policyName}
              count={policy.count}
              href={policy.href}
              depth={0}
              tone={tone}
            />
            {pOpen
              ? policy.sections.map((section) => {
                  const sKey = `s:${policy.policyId}:${section.sectionId}`;
                  const sOpen = openKeys.has(sKey);
                  const sCount = section.clauses.reduce(
                    (n, c) => n + c.items.length,
                    0,
                  );
                  return (
                    <div key={sKey}>
                      <FolderRow
                        open={sOpen}
                        onToggle={() => toggle(sKey)}
                        label={section.sectionLabel}
                        count={sCount}
                        depth={1}
                        tone={tone}
                      />
                      {sOpen
                        ? section.clauses.map((clause) => {
                            const cKey = `c:${clause.clauseId}`;
                            const cOpen = openKeys.has(cKey);
                            const clauseLabel = clause.clauseRef
                              ? `${clause.clauseRef} ${truncate(clause.clauseText, 60)}`
                              : truncate(clause.clauseText, 70);
                            return (
                              <div key={cKey}>
                                <FolderRow
                                  open={cOpen}
                                  onToggle={() => toggle(cKey)}
                                  label={clauseLabel || "Зүйл"}
                                  count={clause.items.length}
                                  href={policy.href}
                                  depth={2}
                                  tone={tone}
                                />
                                {cOpen ? (
                                  <ul
                                    className="mb-1 space-y-0.5"
                                    style={{ paddingLeft: `${3 * 12}px` }}
                                  >
                                    {clause.items.map((item) => (
                                      <LeafItem
                                        key={item.evaluationId}
                                        item={item}
                                        tone={tone}
                                      />
                                    ))}
                                  </ul>
                                ) : null}
                              </div>
                            );
                          })
                        : null}
                    </div>
                  );
                })
              : null}
          </div>
        );
      })}
    </div>
  );
}

export function AttentionNotificationsPanel({
  urgentItems,
  noteItems,
  title = "Яаралтай анхаарах",
}: {
  urgentItems: AttentionFeedItem[];
  noteItems?: AttentionFeedItem[];
  title?: string;
}) {
  const notes = noteItems ?? [];
  const [urgentOpen, setUrgentOpen] = useState(true);
  const [notesOpen, setNotesOpen] = useState(false);

  if (urgentItems.length === 0 && notes.length === 0) return null;

  return (
    <div className="space-y-2">
      {urgentItems.length > 0 ? (
        <section className="overflow-hidden rounded border border-amber-500/40 bg-amber-50 dark:bg-amber-500/10">
          <button
            type="button"
            onClick={() => setUrgentOpen((v) => !v)}
            className="flex w-full items-center gap-2 border-b border-amber-500/30 px-3 py-2 text-left"
          >
            <AlertTriangle
              size={16}
              className="text-amber-700 dark:text-amber-300"
            />
            <h2 className="text-sm font-semibold text-amber-950 dark:text-amber-100">
              {title}
            </h2>
            <span className="rounded-full bg-amber-500/25 px-2 py-0.5 text-[11px] tabular-nums text-amber-950 dark:text-amber-50">
              {urgentItems.length}
            </span>
            <ChevronDown
              size={16}
              className={cn(
                "ml-auto text-amber-700 transition-transform dark:text-amber-300",
                urgentOpen ? "rotate-180" : "",
              )}
            />
          </button>
          {urgentOpen ? (
            <AttentionTree items={urgentItems} tone="urgent" defaultOpen />
          ) : null}
        </section>
      ) : null}

      {notes.length > 0 ? (
        <section className="overflow-hidden rounded border border-sky-500/35 bg-sky-50/80 dark:bg-sky-500/10">
          <button
            type="button"
            onClick={() => setNotesOpen((v) => !v)}
            className="flex w-full items-center gap-2 border-b border-sky-500/25 px-3 py-2 text-left"
          >
            <MessageSquareText
              size={16}
              className="text-sky-700 dark:text-sky-300"
            />
            <h2 className="text-sm font-semibold text-sky-950 dark:text-sky-100">
              Тайлбар / өөрчлөлт (дундажид орно)
            </h2>
            <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[11px] tabular-nums text-sky-950 dark:text-sky-50">
              {notes.length}
            </span>
            <ChevronDown
              size={16}
              className={cn(
                "ml-auto text-sky-700 transition-transform dark:text-sky-300",
                notesOpen ? "rotate-180" : "",
              )}
            />
          </button>
          {notesOpen ? (
            <AttentionTree items={notes} tone="note" defaultOpen />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
