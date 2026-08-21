"use client";

import { ProgressBar } from "@/components/ProgressBar";
import { TableScroll } from "@/components/ui/primitives";
import {
  PROJECT_PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
} from "@/lib/projects-data";
import type { ResearchProject } from "@/lib/types";

export function KpiDetailModal({
  title,
  description,
  projects,
  onClose,
}: {
  title: string;
  description: string;
  projects: ResearchProject[];
  onClose: () => void;
}) {
  const avgProgress =
    projects.length > 0
      ? Math.round(
          projects.reduce((sum, p) => sum + Number(p.progress || 0), 0) /
            projects.length,
        )
      : 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-md border border-[var(--border)] bg-[var(--card)] p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">{description}</p>
          </div>
          <button type="button" className="btn px-2" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-md border border-[var(--border)] bg-slate-50 p-3">
            <p className="text-xs text-[var(--muted)]">Төслийн тоо</p>
            <p className="mt-1 text-2xl font-semibold">{projects.length}</p>
          </div>
          <div className="rounded-md border border-[var(--border)] bg-slate-50 p-3">
            <p className="text-xs text-[var(--muted)]">Дундаж явц</p>
            <p className="mt-1 text-2xl font-semibold">{avgProgress}%</p>
          </div>
          <div className="rounded-md border border-[var(--border)] bg-slate-50 p-3">
            <p className="text-xs text-[var(--muted)]">Хүндрэлтэй</p>
            <p className="mt-1 text-2xl font-semibold text-rose-600">
              {projects.filter((p) => p.issue || p.pending_decision).length}
            </p>
          </div>
        </div>

        <TableScroll>
          <table>
            <thead className="sticky top-0">
              <tr>
                <th>Төсөл</th>
                <th>Ангилал</th>
                <th>Төлөв</th>
                <th>Ач холбогдол</th>
                <th>Явц</th>
                <th>Хариуцагч</th>
              </tr>
            </thead>
            <tbody>
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-sm text-[var(--muted)]">
                    Энэ бүлэгт төсөл алга.
                  </td>
                </tr>
              ) : (
                projects.map((p) => (
                  <tr key={p.id}>
                    <td className="font-semibold">{p.title}</td>
                    <td>{p.category || "—"}</td>
                    <td>{PROJECT_STATUS_LABELS[p.status]}</td>
                    <td>{PROJECT_PRIORITY_LABELS[p.priority]}</td>
                    <td className="w-32">
                      <div className="text-sm font-semibold">{p.progress}%</div>
                      <ProgressBar value={p.progress} />
                    </td>
                    <td>{p.owner || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </TableScroll>
      </div>
    </div>
  );
}
