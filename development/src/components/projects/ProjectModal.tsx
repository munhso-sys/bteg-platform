"use client";

import { useState } from "react";
import type { ProjectPriority, ProjectStatus, ResearchProject } from "@/lib/types";
import { emptyProject } from "@/lib/projects-data";

export function ProjectModal({
  project,
  createMode,
  onClose,
  onSave,
  onDelete,
}: {
  project?: ResearchProject | null;
  createMode: boolean;
  onClose: () => void;
  onSave: (project: ResearchProject) => void;
  onDelete?: (id: string) => void;
}) {
  const initial = project ?? emptyProject();
  const [form, setForm] = useState<ResearchProject>(initial);

  function set<K extends keyof ResearchProject>(key: K, value: ResearchProject[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    if (!form.title.trim()) return;
    onSave({
      ...form,
      id: form.id || `rp-${Date.now()}`,
      progress: Math.max(0, Math.min(100, Number(form.progress) || 0)),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-md border border-[var(--border)] bg-[var(--card)] p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">
            {createMode ? "Шинэ судалгааны төсөл" : "Төслийн дэлгэрэнгүй"}
          </h2>
          <button type="button" className="btn px-2" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="space-y-3">
          <input
            className="input"
            placeholder="Төслийн нэр"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
          <textarea
            className="textarea"
            rows={3}
            placeholder="Тайлбар"
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="input"
              placeholder="Ангилал"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
            />
            <input
              className="input"
              placeholder="Хариуцагч"
              value={form.owner}
              onChange={(e) => set("owner", e.target.value)}
            />
            <select
              className="select"
              value={form.priority}
              onChange={(e) => set("priority", e.target.value as ProjectPriority)}
            >
              <option value="low">Бага</option>
              <option value="medium">Дунд</option>
              <option value="high">Өндөр</option>
            </select>
            <select
              className="select"
              value={form.status}
              onChange={(e) => set("status", e.target.value as ProjectStatus)}
            >
              <option value="active">Идэвхтэй</option>
              <option value="completed">Дууссан</option>
              <option value="hold">Түр зогссон</option>
            </select>
          </div>
          <textarea
            className="textarea"
            rows={2}
            placeholder="Үр дүн"
            value={form.result_summary}
            onChange={(e) => set("result_summary", e.target.value)}
          />
          <textarea
            className="textarea"
            rows={2}
            placeholder="Дараагийн алхам"
            value={form.next_step}
            onChange={(e) => set("next_step", e.target.value)}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-[var(--muted)]">
              Эхлэх
              <input
                type="date"
                className="input mt-1"
                value={form.start_date}
                onChange={(e) => set("start_date", e.target.value)}
              />
            </label>
            <label className="text-xs text-[var(--muted)]">
              Дуусах
              <input
                type="date"
                className="input mt-1"
                value={form.end_date}
                onChange={(e) => set("end_date", e.target.value)}
              />
            </label>
            <label className="text-xs text-[var(--muted)]">
              Сунгасан дуусах огноо
              <input
                type="date"
                className="input mt-1"
                value={form.extended_end_date}
                onChange={(e) => set("extended_end_date", e.target.value)}
              />
            </label>
            <label className="text-xs text-[var(--muted)]">
              Явц %
              <input
                type="number"
                min={0}
                max={100}
                className="input mt-1"
                value={form.progress}
                onChange={(e) => set("progress", Number(e.target.value))}
              />
            </label>
          </div>
          <textarea
            className="textarea"
            rows={2}
            placeholder="Тулгарч буй хүндрэл"
            value={form.issue}
            onChange={(e) => set("issue", e.target.value)}
          />
          <textarea
            className="textarea"
            rows={2}
            placeholder="Хүлээгдэж буй шийдвэр"
            value={form.pending_decision}
            onChange={(e) => set("pending_decision", e.target.value)}
          />
          <label className="flex items-center gap-2 rounded-md border border-[var(--border)] px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_urgent}
              onChange={(e) => set("is_urgent", e.target.checked)}
            />
            Нэн яаралтай төсөл
          </label>
          <input
            className="input"
            placeholder="Файлын нэр"
            value={form.file_name}
            onChange={(e) => set("file_name", e.target.value)}
          />
          <input
            className="input"
            placeholder="Файлын холбоос / URL"
            value={form.file_url}
            onChange={(e) => set("file_url", e.target.value)}
          />
          {form.file_url ? (
            <a
              href={form.file_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-[var(--brand)] underline"
            >
              Хавсаргасан файл нээх
            </a>
          ) : null}
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <div>
            {!createMode && project?.id && onDelete ? (
              <button
                type="button"
                className="btn border-rose-200 text-rose-700"
                onClick={() => onDelete(project.id)}
              >
                Устгах
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn" onClick={onClose}>
              Болих
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              Хадгалах
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
