"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { StatusBadge, PriorityBadge } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/cn";
import type { RiskSignal, RiskWorkStatus } from "@/lib/risk/types";
import type { RowStatus } from "@/lib/placeholder-data";

function workToRowStatus(status: RiskWorkStatus): RowStatus {
  if (status === "overdue") return "overdue";
  if (status === "in_progress") return "in_progress";
  if (status === "mitigated") return "done";
  return "open";
}

function severityPriority(s: RiskSignal["severity"]): "low" | "medium" | "high" {
  if (s === "critical" || s === "high") return "high";
  if (s === "medium") return "medium";
  return "low";
}

export function RiskRegister({
  items,
  loading,
  selectedId,
  onSelect,
  empty = "Шүүлтүүрт тохирох эрсдэл алга.",
}: {
  items: RiskSignal[];
  loading?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  empty?: string;
}) {
  const [localId, setLocalId] = useState<string | null>(selectedId ?? null);
  const activeId = selectedId ?? localId;
  const selected = items.find((i) => i.id === activeId) ?? items[0] ?? null;

  useEffect(() => {
    if (selected && selected.id !== activeId) {
      const id = window.setTimeout(() => {
        if (onSelect) onSelect(selected.id);
        else setLocalId(selected.id);
      }, 0);
      return () => window.clearTimeout(id);
    }
  }, [selected, activeId, onSelect]);

  function pick(id: string) {
    if (onSelect) onSelect(id);
    else setLocalId(id);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.9fr)]">
      <div className="h-scroll soft-scroll min-w-0 overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--card)]">
        <table>
          <thead>
            <tr>
              <th>Эрсдэл</th>
              <th>Эх үүсвэр</th>
              <th>Зэрэг</th>
              <th>Үнэлгээ</th>
              <th>Засвар</th>
              <th>Хугацаа</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-sm text-[var(--muted)]">
                  Ачааллаж байна…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-sm text-[var(--muted)]">
                  {empty}
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr
                  key={item.id}
                  className={cn(
                    "cursor-pointer",
                    selected?.id === item.id ? "bg-[var(--table-hover)]" : "",
                  )}
                  onClick={() => pick(item.id)}
                >
                  <td>
                    <div className="font-medium text-[var(--fg)]">{item.title}</div>
                    <div className="mt-0.5 text-xs text-[var(--muted)]">
                      {item.unit} · {item.owner}
                    </div>
                  </td>
                  <td className="whitespace-nowrap text-xs">{item.sourceLabel}</td>
                  <td>
                    <PriorityBadge priority={severityPriority(item.severity)} />
                  </td>
                  <td className="tabular-nums font-semibold">{item.score}%</td>
                  <td>
                    <StatusBadge status={workToRowStatus(item.status)} />
                  </td>
                  <td className="whitespace-nowrap tabular-nums text-xs">
                    {item.mitigation.dueDate || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <aside className="rounded-md border border-[var(--border)] bg-[var(--card)]">
        <div className="border-b border-[var(--border)] px-3 py-2">
          <h2 className="text-sm font-semibold">Хэрхэн засаж байгаа</h2>
        </div>
        {selected ? (
          <div className="space-y-3 p-3 text-sm">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                {selected.sourceLabel}
              </div>
              <div className="mt-1 font-semibold leading-snug">{selected.title}</div>
              <p className="mt-2 text-[var(--muted)]">{selected.description}</p>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-[var(--muted)]">Нэгж</dt>
                <dd className="mt-0.5">{selected.unit}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Хариуцагч</dt>
                <dd className="mt-0.5">{selected.owner}</dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Магадлал × нөлөө</dt>
                <dd className="mt-0.5 tabular-nums">
                  {selected.likelihood} × {selected.impact}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--muted)]">Явц</dt>
                <dd className="mt-0.5 tabular-nums">
                  {selected.mitigation.progressPercent}%
                </dd>
              </div>
            </dl>
            <div className="h-1.5 overflow-hidden rounded bg-[var(--surface-muted)]">
              <div
                className="h-full bg-[var(--brand)]"
                style={{
                  width: `${Math.min(100, selected.mitigation.progressPercent)}%`,
                }}
              />
            </div>
            <div className="rounded border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
              <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                Хийгдэж буй ажил
              </div>
              <div className="mt-1">{selected.mitigation.workStatus}</div>
              <p className="mt-1 text-[var(--muted)]">{selected.mitigation.summary}</p>
            </div>
            <Link href={selected.href} className="btn btn-primary w-full justify-center">
              Эх модуль руу орох
              <ArrowUpRight size={14} />
            </Link>
          </div>
        ) : (
          <p className="p-3 text-sm text-[var(--muted)]">Эрсдэл сонгоно уу.</p>
        )}
      </aside>
    </div>
  );
}
