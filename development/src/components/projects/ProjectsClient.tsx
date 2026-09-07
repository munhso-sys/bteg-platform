"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressBar } from "@/components/ProgressBar";
import { KpiDetailModal } from "@/components/projects/KpiDetailModal";
import { ProjectModal } from "@/components/projects/ProjectModal";
import { MetricCard, Panel, TableScroll } from "@/components/ui/primitives";
import {
  PROJECT_PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  projectKpis,
} from "@/lib/projects-data";
import type { ResearchProject } from "@/lib/types";

const KPI_META = [
  { key: "total", title: "Нийт төсөл", tone: "default" as const },
  { key: "active", title: "Идэвхтэй", tone: "brand" as const },
  { key: "completed", title: "Дууссан", tone: "ok" as const },
  { key: "high", title: "Өндөр ач холбогдол", tone: "danger" as const },
  { key: "stalled", title: "Тулгамдсан / хүлээгдэж буй", tone: "warn" as const },
  { key: "urgent", title: "Нэн яаралтай", tone: "danger" as const },
] as const;

const KPI_TITLES: Record<string, string> = {
  total: "Нийт төсөл",
  active: "Идэвхтэй төслүүд",
  completed: "Дууссан төслүүд",
  high: "Өндөр ач холбогдолтой төслүүд",
  stalled: "Тулгамдсан / хүлээгдэж буй төслүүд",
  urgent: "Нэн яаралтай төслүүд",
};

export function ProjectsClient() {
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ResearchProject | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/research/projects", { cache: "no-store" });
      const body = (await res.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        projects?: ResearchProject[];
      } | null;
      if (!res.ok || !body?.ok) {
        setProjects([]);
        setError(body?.error || `Load failed (${res.status})`);
        return;
      }
      setProjects(body.projects ?? []);
    } catch (e) {
      setProjects([]);
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      void reload();
    });
  }, [reload]);

  const groups = useMemo(() => projectKpis(projects), [projects]);

  async function saveProject(next: ResearchProject) {
    setSaveError(null);
    const isNew = !projects.some((p) => p.id === next.id);
    const res = await fetch("/api/research/projects", {
      method: isNew ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(isNew ? { ...next, id: undefined } : next),
    });
    const body = (await res.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      project?: ResearchProject;
    } | null;
    if (!res.ok || !body?.ok || !body.project) {
      setSaveError(body?.error || `Save failed (${res.status})`);
      return;
    }
    setSelected(null);
    setCreateMode(false);
    await reload();
  }

  async function deleteProject(id: string) {
    setSaveError(null);
    const res = await fetch(`/api/research/projects?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    const body = (await res.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
    } | null;
    if (!res.ok || !body?.ok) {
      setSaveError(body?.error || `Delete failed (${res.status})`);
      return;
    }
    setSelected(null);
    setCreateMode(false);
    await reload();
  }

  return (
    <div>
      <PageHeader
        title="Судалгааны төслүүд"
        subtitle="Серверт хадгалагдана — байгууллагын RLS хамгаалалттай"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setSelected(null);
              setCreateMode(true);
              setSaveError(null);
            }}
          >
            + Шинэ төсөл
          </button>
        }
      />

      {error ? (
        <div role="alert" className="mb-4 rounded-md border border-rose-400/50 bg-rose-500/10 px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}
      {saveError ? (
        <div role="alert" className="mb-4 rounded-md border border-rose-400/50 bg-rose-500/10 px-3 py-2 text-sm">
          Хадгалалт амжилтгүй: {saveError}
        </div>
      ) : null}
      {loading ? (
        <p className="mb-4 text-sm text-[var(--muted)]">Ачаалж байна…</p>
      ) : null}

      <section className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-6">
        {KPI_META.map((kpi) => (
          <MetricCard
            key={kpi.key}
            label={kpi.title}
            value={String(groups[kpi.key].length)}
            hint="Дэлгэрэнгүй харах"
            tone={kpi.tone}
            onClick={() => setSelectedKpi(kpi.key)}
          />
        ))}
      </section>

      <Panel title="Судалгааны төслүүд" description="Нэр, ангилал, төлөв, явц, хугацаа, хариуцагч">
        <TableScroll>
          <table>
            <thead className="sticky top-0">
              <tr>
                <th>Нэр</th>
                <th>Ангилал</th>
                <th>Төлөв</th>
                <th>Явц</th>
                <th>Эхлэх</th>
                <th>Дуусах</th>
                <th>Хариуцагч</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => {
                    setCreateMode(false);
                    setSelected(p);
                    setSaveError(null);
                  }}
                  className="cursor-pointer"
                >
                  <td>
                    <div className="font-semibold">{p.title}</div>
                    {p.is_urgent ? (
                      <div className="mt-1 text-xs font-medium text-rose-600">Нэн яаралтай</div>
                    ) : null}
                  </td>
                  <td>{p.category || "—"}</td>
                  <td>
                    <span className={`status status-${p.status}`}>
                      {PROJECT_STATUS_LABELS[p.status]}
                    </span>
                    {p.priority === "high" ? (
                      <div className="mt-1 text-xs text-rose-600">
                        {PROJECT_PRIORITY_LABELS[p.priority]}
                      </div>
                    ) : null}
                  </td>
                  <td className="w-28">
                    <div className="text-sm font-semibold">{p.progress}%</div>
                    <ProgressBar value={p.progress} />
                  </td>
                  <td>{p.start_date || "—"}</td>
                  <td>{p.extended_end_date || p.end_date || "—"}</td>
                  <td>{p.owner || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      </Panel>

      {(selected || createMode) && (
        <ProjectModal
          project={selected}
          createMode={createMode}
          onClose={() => {
            setSelected(null);
            setCreateMode(false);
          }}
          onSave={saveProject}
          onDelete={deleteProject}
        />
      )}

      {selectedKpi && (
        <KpiDetailModal
          title={KPI_TITLES[selectedKpi]}
          description="Төслийн дэлгэрэнгүй мэдээлэл, явц, хүндрэл, хүлээгдэж буй шийдвэр"
          projects={groups[selectedKpi as keyof typeof groups] || []}
          onClose={() => setSelectedKpi(null)}
        />
      )}
    </div>
  );
}
