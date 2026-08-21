"use client";

import { useState } from "react";
import { pillars } from "@/lib/program-data";
import { quartersFromDates } from "@/lib/quarters";
import type {
  ProgramInitiative,
  ProgramPillarId,
  ProgramStatus,
} from "@/lib/types";

export function InitiativeModal({
  item,
  createMode,
  onClose,
  onSave,
  onDelete,
}: {
  item: ProgramInitiative;
  createMode: boolean;
  onClose: () => void;
  onSave: (item: ProgramInitiative) => void;
  onDelete?: (id: string) => void;
}) {
  const [form, setForm] = useState<ProgramInitiative>(item);

  function set<K extends keyof ProgramInitiative>(
    key: K,
    value: ProgramInitiative[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function applyDatesToQuarters() {
    setForm((prev) => ({
      ...prev,
      quarters: quartersFromDates(prev.start_date, prev.end_date, prev.year),
    }));
  }

  function handleSave() {
    if (!form.title.trim()) return;
    onSave(form);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-md border border-[var(--border)] bg-[var(--card)] p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-lg font-semibold">
            {createMode ? "Шинэ ажил" : "Ажлын дэлгэрэнгүй"}
          </h2>
          <button type="button" className="btn px-2" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="space-y-3">
          <input
            className="input"
            placeholder="Ажлын нэр"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <select
              className="select"
              value={form.pillarId}
              onChange={(e) => set("pillarId", e.target.value as ProgramPillarId)}
            >
              {pillars.map((pillar) => (
                <option key={pillar.id} value={pillar.id}>
                  {pillar.no}. {pillar.title}
                </option>
              ))}
            </select>
            <select
              className="select"
              value={form.status}
              onChange={(e) => set("status", e.target.value as ProgramStatus)}
            >
              <option value="planned">Төлөвлөсөн</option>
              <option value="in_progress">Явагдаж буй</option>
              <option value="completed">Дууссан</option>
              <option value="delayed">Хоцролттой</option>
            </select>
            <input
              className="input"
              placeholder="Хариуцагч"
              value={form.owner}
              onChange={(e) => set("owner", e.target.value)}
            />
            <input
              className="input"
              placeholder="Нэгж"
              value={form.department}
              onChange={(e) => set("department", e.target.value)}
            />
            <label className="text-xs text-[var(--muted)]">
              Оноо
              <input
                type="number"
                min={0}
                max={100}
                className="input mt-1"
                value={form.score}
                onChange={(e) => set("score", Number(e.target.value))}
              />
            </label>
            <label className="text-xs text-[var(--muted)]">
              Жил
              <input
                type="number"
                className="input mt-1"
                value={form.year}
                onChange={(e) => set("year", Number(e.target.value))}
              />
            </label>
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
          </div>
          <button type="button" className="btn" onClick={applyDatesToQuarters}>
            Эхлэх–дуусах огноогоор I–IV улирал бөглөх
          </button>
          <p className="text-xs text-[var(--muted)]">
            Хүснэгт дээрх I–IV нүдийг дараад: төлөвлөөгүй → төлөвлөсөн → хийсэн.
            Өнгөрсөн төлөвлөгөө автоматаар хоцролт болно.
          </p>
        </div>

        <div className="mt-5 flex items-center justify-between gap-2">
          <div>
            {!createMode && item.id && onDelete ? (
              <button
                type="button"
                className="btn border-rose-200 text-rose-700"
                onClick={() => onDelete(item.id)}
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
