"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, X } from "lucide-react";

export type UnitPolicyItem = {
  id: string;
  name: string;
  reference_code: string | null;
  evaluated: boolean;
};

export type UnitComplianceTableRow = {
  id: string;
  kind: "heltes" | "alba";
  name: string;
  heltesName: string | null;
  avg: number | null;
  evaluationCount: number;
  relatedPolicyCount: number;
  evaluatedPolicyCount: number;
  policies: UnitPolicyItem[];
};

type Props = {
  rows: UnitComplianceTableRow[];
};

export function OrgUnitComplianceTable({ rows }: Props) {
  const [open, setOpen] = useState<UnitComplianceTableRow | null>(null);

  return (
    <>
      <div className="h-scroll-panel max-h-[480px]">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-white text-xs uppercase text-slate-500">
            <tr>
              <th className="py-1.5 pr-2">#</th>
              <th className="py-1.5 pr-2">Нэгж</th>
              <th className="py-1.5 pr-2">Төрөл</th>
              <th className="py-1.5 pr-2">Дундаж оноо (0–100)</th>
              <th className="py-1.5 pr-2">Үнэлгээний тоо</th>
              <th className="py-1.5 pr-2">Холбогдох журам</th>
              <th className="py-1.5 pr-2">Үнэлсэн журам</th>
              <th className="py-1.5">Журам</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d, i) => (
              <tr key={d.id} className="border-b border-slate-100">
                <td className="py-1.5 pr-2 tabular-nums text-xs text-slate-500">
                  {i + 1}
                </td>
                <td className="py-1.5 pr-2">
                  <div className="font-medium">{d.name}</div>
                  {d.heltesName ? (
                    <div className="text-xs text-slate-500">{d.heltesName}</div>
                  ) : null}
                </td>
                <td className="py-1.5 pr-2 text-xs text-slate-600">
                  {d.kind === "heltes" ? "Хэлтэс" : "Алба"}
                </td>
                <td className="py-1.5 pr-2 tabular-nums">
                  {d.avg != null ? d.avg : "—"}
                </td>
                <td className="py-1.5 pr-2 tabular-nums">{d.evaluationCount}</td>
                <td className="py-1.5 pr-2 tabular-nums">{d.relatedPolicyCount}</td>
                <td className="py-1.5 pr-2 tabular-nums">{d.evaluatedPolicyCount}</td>
                <td className="py-1.5">
                  <button
                    type="button"
                    onClick={() => setOpen(d)}
                    disabled={!d.policies.length}
                    className="rounded border border-slate-300 p-1.5 text-slate-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
                    title="Журмын нэрс харах"
                    aria-label="Журмын нэрс харах"
                  >
                    <Eye size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-slate-500">{rows.length} нэгж</p>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Хаах"
            onClick={() => setOpen(null)}
          />
          <div className="relative z-10 flex max-h-[80vh] w-full max-w-lg flex-col rounded-lg bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <div className="min-w-0">
                <div className="text-xs text-slate-500">
                  {open.kind === "heltes" ? "Хэлтэс" : "Алба"}
                  {open.heltesName ? ` · ${open.heltesName}` : ""}
                </div>
                <h3 className="truncate text-base font-semibold">{open.name}</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  {open.policies.length} журам · үнэлсэн{" "}
                  {open.policies.filter((p) => p.evaluated).length}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="rounded p-1.5 hover:bg-slate-100"
                aria-label="Хаах"
              >
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
              {open.policies.length === 0 ? (
                <p className="text-sm text-slate-500">Журам байхгүй.</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {open.policies.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-start justify-between gap-2 py-2"
                    >
                      <div className="min-w-0">
                        <Link
                          href={`/policies/${p.id}`}
                          className="font-medium hover:underline"
                          onClick={() => setOpen(null)}
                        >
                          {p.name}
                        </Link>
                        {p.reference_code ? (
                          <div className="font-mono text-xs text-slate-500">
                            {p.reference_code}
                          </div>
                        ) : null}
                      </div>
                      <span
                        className={
                          p.evaluated
                            ? "shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-800"
                            : "shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600"
                        }
                      >
                        {p.evaluated ? "Үнэлсэн" : "Үнэлээгүй"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
