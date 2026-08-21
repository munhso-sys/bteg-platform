"use client";

import { useState } from "react";
import type { TableRow } from "@/lib/placeholder-data";
import { PriorityBadge, StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";

function MobileCards({
  rows,
  onSelect,
  selectedId,
}: {
  rows: TableRow[];
  onSelect?: (row: TableRow) => void;
  selectedId?: string;
}) {
  return (
    <div className="mobile-only space-y-2">
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          onClick={() => onSelect?.(row)}
          className={`w-full rounded-md border border-[var(--border)] bg-white p-3 text-left transition ${
            selectedId === row.id ? "border-[var(--brand)] bg-amber-50/50" : ""
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold leading-snug">{row.title}</div>
              <div className="mt-1 font-mono text-[11px] text-[var(--muted)]">
                {row.id}
              </div>
            </div>
            <StatusBadge status={row.status} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--muted)]">
            <div>
              <div className="uppercase tracking-wide">Хариуцсан</div>
              <div className="mt-0.5 text-[var(--fg)]">{row.owner}</div>
            </div>
            <div>
              <div className="uppercase tracking-wide">Хэлтэс</div>
              <div className="mt-0.5 text-[var(--fg)]">{row.department}</div>
            </div>
            <div>
              <div className="uppercase tracking-wide">Ач холбогдол</div>
              <div className="mt-0.5">
                <PriorityBadge priority={row.priority} />
              </div>
            </div>
            <div>
              <div className="uppercase tracking-wide">Хугацаа</div>
              <div className="mt-0.5 tabular-nums text-[var(--fg)]">
                {row.dueDate}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

export function DataTable({
  rows,
  onSelect,
  selectedId,
}: {
  rows: TableRow[];
  onSelect?: (row: TableRow) => void;
  selectedId?: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title="Өгөгдөл алга" description="Шүүлтүүрээ өөрчилнө үү." />;
  }

  return (
    <>
      <MobileCards rows={rows} onSelect={onSelect} selectedId={selectedId} />
      <div className="desk-only h-scroll soft-scroll rounded-md border border-[var(--border)] bg-white">
        <table className="min-w-[720px]">
          <thead>
            <tr>
              <th>ID</th>
              <th>Гарчиг</th>
              <th>Хариуцсан</th>
              <th>Хэлтэс</th>
              <th>Төлөв</th>
              <th>Ач холбогдол</th>
              <th>Шинэчилсэн</th>
              <th>Хугацаа</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => onSelect?.(row)}
                className={`cursor-pointer ${selectedId === row.id ? "bg-amber-50/70" : ""}`}
              >
                <td className="font-mono text-xs text-[var(--muted)]">{row.id}</td>
                <td className="font-medium">{row.title}</td>
                <td>{row.owner}</td>
                <td>{row.department}</td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td>
                  <PriorityBadge priority={row.priority} />
                </td>
                <td className="tabular-nums text-sm">{row.updatedAt}</td>
                <td className="tabular-nums text-sm">{row.dueDate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function SelectableTable({ rows }: { rows: TableRow[] }) {
  const [selected, setSelected] = useState(rows[0]);
  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
      <DataTable
        rows={rows}
        selectedId={selected?.id}
        onSelect={setSelected}
      />
      <aside className="h-fit rounded-md border border-[var(--border)] bg-white">
        <div className="border-b border-[var(--border)] px-3 py-2">
          <div className="text-sm font-semibold text-[var(--fg)]">
            Дэлгэрэнгүй / үйлдэл
          </div>
        </div>
        <div className="p-3">
          {selected ? (
            <>
              <h3 className="text-sm font-semibold">{selected.title}</h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--muted)]">ID</dt>
                  <dd className="font-mono text-xs">{selected.id}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--muted)]">Хариуцсан</dt>
                  <dd>{selected.owner}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--muted)]">Хэлтэс</dt>
                  <dd>{selected.department}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--muted)]">Төлөв</dt>
                  <dd>
                    <StatusBadge status={selected.status} />
                  </dd>
                </div>
              </dl>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <button type="button" className="btn btn-primary w-full">
                  Нээх
                </button>
                <button type="button" className="btn btn-ghost w-full">
                  Тэмдэглэл нэмэх
                </button>
              </div>
            </>
          ) : (
            <EmptyState
              title="Мөр сонгоогүй"
              description="Хүснэгтээс мөр сонгоно уу."
            />
          )}
        </div>
      </aside>
    </div>
  );
}
