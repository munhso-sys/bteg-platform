"use client";

import { useMemo, useState } from "react";
import type { ProcessMatrixRow } from "@/lib/types";

type Props = {
  rows: ProcessMatrixRow[];
  onRowClick?: (row: ProcessMatrixRow) => void;
};

export function MatrixTable({ rows, onRowClick }: Props) {
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState<string>("all");

  const sheets = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) {
      if (r.sheet_name) s.add(r.sheet_name);
    }
    return [...s].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (sheet !== "all" && r.sheet_name !== sheet) return false;
      if (!query) return true;
      const blob = [
        r.task_name,
        r.input_data,
        r.output_data,
        r.process_text,
        r.position_title,
        ...Object.keys(r.role_matrix),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return blob.includes(query);
    });
  }, [rows, q, sheet]);

  const roleKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const r of filtered.slice(0, 50)) {
      Object.keys(r.role_matrix).forEach((k) => keys.add(k));
    }
    return [...keys].slice(0, 8);
  }, [filtered]);

  return (
    <div className="flex h-full min-h-[420px] flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <input
          className="min-w-[200px] flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm"
          placeholder="Хайх…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
          value={sheet}
          onChange={(e) => setSheet(e.target.value)}
        >
          <option value="all">Бүх sheet</option>
          {sheets.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <span className="self-center text-xs text-[var(--muted)]">
          {filtered.length} мөр
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="sticky top-0 bg-[var(--background)] text-[11px] uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-2 py-2">№</th>
              <th className="px-2 py-2">Даалгавар / үйл явц</th>
              <th className="px-2 py-2">Оролт</th>
              <th className="px-2 py-2">Гаралт</th>
              <th className="px-2 py-2">R / A</th>
              {roleKeys.map((k) => (
                <th key={k} className="px-2 py-2">
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr
                key={r.id}
                className="cursor-pointer border-t border-[var(--border)] hover:bg-teal-50/60 dark:hover:bg-teal-950/30"
                onClick={() => onRowClick?.(r)}
              >
                <td className="px-2 py-1.5 text-xs text-[var(--muted)]">
                  {r.step_number ?? "—"}
                </td>
                <td className="px-2 py-1.5 font-medium">{r.task_name}</td>
                <td className="max-w-[180px] truncate px-2 py-1.5 text-xs">
                  {r.input_data || "—"}
                </td>
                <td className="max-w-[180px] truncate px-2 py-1.5 text-xs">
                  {r.output_data || "—"}
                </td>
                <td className="px-2 py-1.5 text-xs">
                  {[r.responsible_role, r.accountable_role]
                    .filter(Boolean)
                    .join(" / ") || "—"}
                </td>
                {roleKeys.map((k) => (
                  <td key={k} className="px-2 py-1.5 text-center text-xs font-semibold">
                    {r.role_matrix[k] || ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length ? (
          <p className="p-4 text-sm text-[var(--muted)]">Мөр олдсонгүй</p>
        ) : null}
      </div>
    </div>
  );
}
