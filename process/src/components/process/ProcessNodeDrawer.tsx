"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ClipboardCheck,
  FileCheck2,
  Megaphone,
  ShieldAlert,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { ProcessAnalytics, ProcessNode } from "@/lib/types";
import {
  PROCESS_LEVEL_LABELS,
  PROCESS_STATUS_LABELS,
  ROOT_CAUSE_LABELS,
} from "@/lib/types";

type TabId =
  | "raci"
  | "inspections"
  | "issues"
  | "risk"
  | "voice";

const TABS: { id: TabId; label: string; icon: typeof FileCheck2 }[] = [
  { id: "raci", label: "RACI & Журмууд", icon: FileCheck2 },
  { id: "inspections", label: "Шалгалт", icon: ClipboardCheck },
  { id: "issues", label: "Зөрчил / RCA", icon: AlertTriangle },
  { id: "risk", label: "Эрсдэл", icon: ShieldAlert },
  { id: "voice", label: "Дуу хоолой", icon: Megaphone },
];

const RISK_BADGE: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-800",
  medium: "bg-amber-100 text-amber-900",
  high: "bg-orange-100 text-orange-900",
  critical: "bg-rose-100 text-rose-900",
};

export function ProcessNodeDrawer({
  node,
  open,
  onClose,
}: {
  node: ProcessNode | null;
  open: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<TabId>("raci");
  const [analytics, setAnalytics] = useState<ProcessAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !node) return;
    setTab("raci");
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/v1/processes/${node.id}/analytics`)
      .then(async (r) => {
        const json = (await r.json()) as {
          data?: ProcessAnalytics;
          error?: string;
        };
        if (!r.ok) throw new Error(json.error || "Failed to load analytics");
        if (!cancelled) setAnalytics(json.data ?? null);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Load failed");
          setAnalytics(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, node]);

  if (!open || !node) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--card)] shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            {PROCESS_LEVEL_LABELS[node.level]} ·{" "}
            {PROCESS_STATUS_LABELS[node.status]}
          </div>
          <h2 className="truncate text-lg font-semibold">{node.title}</h2>
          <div className="font-mono text-xs text-[var(--muted)]">{node.code}</div>
        </div>
        <button
          type="button"
          className="rounded-md p-2 text-[var(--muted)] hover:bg-black/5"
          onClick={onClose}
          aria-label="Хаах"
        >
          <X size={18} />
        </button>
      </div>

      {analytics ? (
        <div className="grid grid-cols-2 gap-2 border-b border-[var(--border)] px-4 py-3 text-xs">
          <Stat
            label="Биелэлт"
            value={`${analytics.procedure_compliance_rate}%`}
          />
          <Stat label="Нээлттэй зөрчил" value={String(analytics.open_issues_count)} />
          <Stat label="Эрсдэлийн оноо" value={String(analytics.risk_score)} />
          <Stat
            label="Дуу хоолой"
            value={String(analytics.employee_reports_count)}
          />
          <div className="col-span-2">
            <span
              className={cn(
                "inline-flex rounded-md px-2 py-1 text-xs font-semibold",
                RISK_BADGE[analytics.risk_level],
              )}
            >
              Эрсдэл: {analytics.risk_level.toUpperCase()} · health{" "}
              {analytics.health}
            </span>
          </div>
        </div>
      ) : null}

      <div className="flex gap-1 overflow-x-auto border-b border-[var(--border)] px-2 py-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium",
                tab === t.id
                  ? "bg-[var(--brand)] text-white"
                  : "text-[var(--muted)] hover:bg-black/5",
              )}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-3 text-sm">
        {loading ? (
          <p className="text-[var(--muted)]">Ачаалж байна…</p>
        ) : error ? (
          <p className="text-[var(--danger)]">{error}</p>
        ) : !analytics ? (
          <p className="text-[var(--muted)]">Мэдээлэл олдсонгүй</p>
        ) : tab === "raci" ? (
          <RaciTab analytics={analytics} />
        ) : tab === "inspections" ? (
          <InspectionsTab analytics={analytics} />
        ) : tab === "issues" ? (
          <IssuesTab analytics={analytics} />
        ) : tab === "risk" ? (
          <RiskTab analytics={analytics} />
        ) : (
          <VoiceTab analytics={analytics} />
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
        {label}
      </div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}

function RaciTab({ analytics }: { analytics: ProcessAnalytics }) {
  if (!analytics.procedures.length) {
    return <Empty text="Холбоотой журам / RACI байхгүй" />;
  }
  return (
    <ul className="space-y-3">
      {analytics.procedures.map((p) => (
        <li
          key={p.id}
          className="rounded-md border border-[var(--border)] px-3 py-2"
        >
          <div className="font-medium">{p.title}</div>
          <dl className="mt-2 grid grid-cols-2 gap-1 text-xs text-[var(--muted)]">
            <div>R: {p.responsible_role || "—"}</div>
            <div>A: {p.accountable_role || "—"}</div>
            <div>C: {p.consulted_role || "—"}</div>
            <div>I: {p.informed_role || "—"}</div>
          </dl>
        </li>
      ))}
    </ul>
  );
}

function InspectionsTab({ analytics }: { analytics: ProcessAnalytics }) {
  if (!analytics.inspections.length) {
    return <Empty text="Холбоотой шалгалт байхгүй" />;
  }
  return (
    <ul className="space-y-3">
      {analytics.inspections.map((i) => (
        <li
          key={i.id}
          className="rounded-md border border-[var(--border)] px-3 py-2"
        >
          <div className="font-medium">{i.checklist_name}</div>
          <div className="mt-1 text-xs text-[var(--muted)]">
            {i.status}
            {i.pass_rate != null ? ` · ${i.pass_rate}% pass` : ""}
            {i.completed_at
              ? ` · ${new Date(i.completed_at).toLocaleDateString("mn-MN")}`
              : ""}
          </div>
        </li>
      ))}
      {analytics.inspection_pass_rate != null ? (
        <p className="text-xs text-[var(--muted)]">
          Дундаж pass rate: {analytics.inspection_pass_rate.toFixed(1)}%
        </p>
      ) : null}
    </ul>
  );
}

function IssuesTab({ analytics }: { analytics: ProcessAnalytics }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 text-xs font-semibold uppercase text-[var(--muted)]">
          Root cause breakdown
        </div>
        <ul className="space-y-1 text-xs">
          {(
            Object.entries(analytics.root_cause_breakdown) as [
              keyof typeof ROOT_CAUSE_LABELS,
              number,
            ][]
          ).map(([k, v]) => (
            <li key={k} className="flex justify-between gap-2">
              <span>{ROOT_CAUSE_LABELS[k]}</span>
              <span className="font-semibold">{v}</span>
            </li>
          ))}
        </ul>
      </div>
      {!analytics.issues.length ? (
        <Empty text="Зөрчил бүртгэгдээгүй" />
      ) : (
        <ul className="space-y-3">
          {analytics.issues.map((iss) => (
            <li
              key={iss.id}
              className="rounded-md border border-[var(--border)] px-3 py-2"
            >
              <div className="font-medium">{iss.title}</div>
              <div className="mt-1 text-xs text-[var(--muted)]">
                {iss.severity} · {iss.status}
                {iss.root_cause_category
                  ? ` · ${ROOT_CAUSE_LABELS[iss.root_cause_category]}`
                  : ""}
              </div>
              {iss.root_cause_description ? (
                <p className="mt-1 text-xs">{iss.root_cause_description}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RiskTab({ analytics }: { analytics: ProcessAnalytics }) {
  if (!analytics.risks.length) {
    return <Empty text="Эрсдэлийн бүртгэл байхгүй" />;
  }
  return (
    <ul className="space-y-3">
      {analytics.risks.map((r) => (
        <li
          key={r.id}
          className="rounded-md border border-[var(--border)] px-3 py-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium">{r.title}</div>
            <span
              className={cn(
                "rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                RISK_BADGE[r.level],
              )}
            >
              {r.level}
            </span>
          </div>
          <div className="mt-1 text-xs text-[var(--muted)]">
            Score {r.score}
          </div>
        </li>
      ))}
    </ul>
  );
}

function VoiceTab({ analytics }: { analytics: ProcessAnalytics }) {
  if (!analytics.employee_reports.length) {
    return <Empty text="Ажилтны дуу хоолой байхгүй" />;
  }
  return (
    <ul className="space-y-3">
      {analytics.employee_reports.map((r) => (
        <li
          key={r.id}
          className="rounded-md border border-[var(--border)] px-3 py-2"
        >
          <div className="font-medium">{r.title}</div>
          <div className="mt-1 text-xs text-[var(--muted)]">
            {r.category} · {r.status} ·{" "}
            {new Date(r.created_at).toLocaleDateString("mn-MN")}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-[var(--muted)]">{text}</p>;
}
