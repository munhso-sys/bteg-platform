"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { ManagementNav } from "@/components/management/ManagementNav";
import { PageHeader } from "@/components/ui/PageHeader";
import { cn } from "@/lib/cn";
import type { UsageEvent, UsageTreeNode } from "@/lib/usage/types";

type Totals = {
  events: number;
  logins: number;
  moduleViews: number;
  openaiCalls: number;
  totalTokens: number;
};

function NodeRow({
  node,
  depth,
}: {
  node: UsageTreeNode;
  depth: number;
}) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children.length > 0;

  return (
    <div className="border-b border-[var(--border)] last:border-b-0">
      <button
        type="button"
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-[var(--surface-muted)]"
        style={{ paddingLeft: 12 + depth * 16 }}
        onClick={() => hasChildren && setOpen((v) => !v)}
        aria-expanded={hasChildren ? open : undefined}
      >
        <span className="mt-0.5 w-4 shrink-0 text-[var(--muted)]">
          {hasChildren ? (
            open ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-[var(--fg)]">
            {node.label}
            <span className="ml-2 text-[11px] font-normal uppercase tracking-wide text-[var(--muted)]">
              {node.level}
            </span>
          </span>
          <span className="mt-0.5 block text-xs text-[var(--muted)]">
            нэвтрэлт {node.logins} · модуль {node.moduleViews} · AI {node.openaiCalls} ·
            token {node.totalTokens}
          </span>
        </span>
      </button>
      {open && hasChildren
        ? node.children.map((child) => (
            <NodeRow key={child.key} node={child} depth={depth + 1} />
          ))
        : null}
      {open && node.level === "user" && node.recent.length > 0 ? (
        <ul
          className="space-y-1 border-t border-[var(--border)] bg-[var(--surface-muted)]/40 px-3 py-2 text-xs text-[var(--muted)]"
          style={{ paddingLeft: 28 + depth * 16 }}
        >
          {[...node.recent].reverse().map((ev) => (
            <li key={ev.id}>
              <span className="font-mono">{new Date(ev.at).toLocaleString("mn-MN")}</span>
              {" · "}
              {ev.kind}
              {ev.module ? ` · ${ev.module}` : ""}
              {ev.path ? ` · ${ev.path}` : ""}
              {ev.totalTokens != null ? ` · ${ev.totalTokens} tok` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function ManagementUsagePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<"all" | "login" | "module_view" | "openai">(
    "all",
  );
  const [totals, setTotals] = useState<Totals | null>(null);
  const [tree, setTree] = useState<UsageTreeNode[]>([]);
  const [recent, setRecent] = useState<UsageEvent[]>([]);
  const [note, setNote] = useState("");

  async function load(nextKind = kind) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `/api/management-center/usage?kind=${encodeURIComponent(nextKind)}`,
        { cache: "no-store" },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Ачаалахад алдаа");
        return;
      }
      setTotals(data.totals);
      setTree(data.tree ?? []);
      setRecent(data.recent ?? []);
      setNote(data.note ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filters = useMemo(
    () =>
      [
        { id: "all" as const, label: "Бүгд" },
        { id: "login" as const, label: "Нэвтрэлт" },
        { id: "module_view" as const, label: "Модуль" },
        { id: "openai" as const, label: "OpenAI" },
      ] as const,
    [],
  );

  return (
    <div>
      <ManagementNav />
      <PageHeader
        title="Хэрэглээ / нэвтрэлтийн лог"
        description="Нэвтрэлт, модулийн ашиглалт, OpenAI token-ийг алба · хэлтэс · role · хэрэглэгчээр бүлэглэн харна."
      />

      {note ? (
        <p className="mb-3 rounded-md border border-amber-300/50 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-500/30 dark:bg-amber-950/20 dark:text-amber-100">
          {note}
        </p>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            className={cn(
              "rounded-md border px-3 py-1.5 text-sm",
              kind === f.id
                ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                : "border-[var(--border)] text-[var(--fg)]",
            )}
            onClick={() => {
              setKind(f.id);
              void load(f.id);
            }}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          className="btn ml-auto inline-flex items-center gap-1.5"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Шинэчлэх
        </button>
      </div>

      {totals ? (
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Нийт event", totals.events],
            ["Нэвтрэлт", totals.logins],
            ["Модуль view", totals.moduleViews],
            ["OpenAI дуудлага", totals.openaiCalls],
            ["Token", totals.totalTokens],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-2"
            >
              <div className="text-[11px] uppercase tracking-wide text-[var(--muted)]">
                {label}
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {error ? (
        <p className="mb-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>
      ) : null}

      <div className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--card)]">
        {loading && tree.length === 0 ? (
          <div className="flex items-center gap-2 px-3 py-8 text-sm text-[var(--muted)]">
            <Loader2 className="h-4 w-4 animate-spin" /> Ачаалж байна…
          </div>
        ) : tree.length === 0 ? (
          <div className="px-3 py-8 text-sm text-[var(--muted)]">
            Одоогоор лог алга. Нэвтэрч модуль нээх / AI ашиглахад энд цугларна.
          </div>
        ) : (
          tree.map((node) => <NodeRow key={node.key} node={node} depth={0} />)
        )}
      </div>

      {recent.length > 0 ? (
        <div className="mt-4">
          <h2 className="mb-2 text-sm font-semibold text-[var(--fg)]">
            Сүүлийн event
          </h2>
          <ul className="space-y-1 rounded-md border border-[var(--border)] bg-[var(--card)] p-3 text-xs text-[var(--muted)]">
            {recent.map((ev) => (
              <li key={ev.id}>
                <span className="font-mono">{new Date(ev.at).toLocaleString("mn-MN")}</span>
                {" · "}
                <strong className="text-[var(--fg)]">{ev.kind}</strong>
                {ev.fullName || ev.email
                  ? ` · ${ev.fullName || ev.email}`
                  : ""}
                {ev.heltesName ? ` · ${ev.heltesName}` : ""}
                {ev.albaName ? ` / ${ev.albaName}` : ""}
                {ev.roleId ? ` · ${ev.roleId}` : ""}
                {ev.module ? ` · ${ev.module}` : ""}
                {ev.path ? ` · ${ev.path}` : ""}
                {ev.totalTokens != null ? ` · ${ev.totalTokens} tok` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
