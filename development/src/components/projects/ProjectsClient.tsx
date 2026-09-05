"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PrototypePersistenceBanner } from "@/components/PrototypePersistenceBanner";
import { ProgressBar } from "@/components/ProgressBar";
import { KpiDetailModal } from "@/components/projects/KpiDetailModal";
import { ProjectModal } from "@/components/projects/ProjectModal";
import { MetricCard, Panel, TableScroll } from "@/components/ui/primitives";
import {
  PROJECT_PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  projectKpis,
  seedProjects,
} from "@/lib/projects-data";
import {
  RD_PROJECTS_BASE_KEY,
  clearLegacyRdSharedKeys,
  readRdJsonArray,
  writeRdJsonArray,
} from "@/lib/rd-storage";
import { useRdUserId } from "@/lib/use-rd-user-id";
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

function loadProjects(userId: string | null): ResearchProject[] {
  const namespaced = readRdJsonArray<ResearchProject>(
    window.localStorage,
    RD_PROJECTS_BASE_KEY,
    userId,
  );
  if (namespaced && namespaced.length > 0) return namespaced;
  // Do not fall back to legacy shared key once namespacing is active.
  return seedProjects;
}

export function ProjectsClient() {
  const { userId, ready } = useRdUserId();
  const [projects, setProjects] = useState<ResearchProject[]>(seedProjects);
  const [hydrated, setHydrated] = useState(false);
  const [selected, setSelected] = useState<ResearchProject | null>(null);
  const [createMode, setCreateMode] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      clearLegacyRdSharedKeys(window.localStorage);
      setProjects(loadProjects(userId));
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [ready, userId]);

  useEffect(() => {
    if (!hydrated || !ready) return;
    writeRdJsonArray(
      window.localStorage,
      RD_PROJECTS_BASE_KEY,
      userId,
      projects,
    );
  }, [hydrated, ready, userId, projects]);

  const groups = useMemo(() => projectKpis(projects), [projects]);

  function saveProject(next: ResearchProject) {
    setProjects((prev) => {
      const exists = prev.some((p) => p.id === next.id);
      return exists ? prev.map((p) => (p.id === next.id ? next : p)) : [next, ...prev];
    });
    setSelected(null);
    setCreateMode(false);
  }

  function deleteProject(id: string) {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setSelected(null);
    setCreateMode(false);
  }

  return (
    <div>
      <PrototypePersistenceBanner />
      <PageHeader
        title="Судалгааны төслүүд"
        subtitle="Судалгаа, инноваци, хөгжүүлэлтийн төслүүд — явц, төлөв, хариуцагч"
        actions={
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setSelected(null);
              setCreateMode(true);
            }}
          >
            + Шинэ төсөл
          </button>
        }
      />

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

      <Panel
        title="Судалгааны төслүүд"
        description="Нэр, ангилал, төлөв, явц, хугацаа, хариуцагч"
      >
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
                  }}
                  className="cursor-pointer"
                >
                  <td>
                    <div className="font-semibold">{p.title}</div>
                    {p.is_urgent ? (
                      <div className="mt-1 text-xs font-medium text-rose-600">
                        Нэн яаралтай
                      </div>
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
