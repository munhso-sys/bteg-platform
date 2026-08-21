"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { VoiceNav } from "@/components/voice/VoiceNav";
import type { EmployeeVoiceItem, VoiceAction } from "@/lib/voice/types";
import { ACTION_KIND_LABELS, VOICE_TYPE_LABELS } from "@/lib/voice/types";

export default function VoiceActionsPage() {
  const [items, setItems] = useState<EmployeeVoiceItem[]>([]);
  const [actions, setActions] = useState<VoiceAction[]>([]);
  const [title, setTitle] = useState("");
  const [voiceId, setVoiceId] = useState("");
  const [owner, setOwner] = useState("");
  const [dueDate, setDueDate] = useState("");

  async function load() {
    const res = await fetch("/api/employee-voice/actions", { cache: "no-store" });
    const data = await res.json();
    if (data.ok) {
      setItems(data.items ?? []);
      setActions(data.actions ?? []);
    }
  }

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  async function addAction() {
    if (!voiceId || !title.trim()) return;
    await fetch("/api/employee-voice/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ voiceId, title, owner, dueDate: dueDate || null, kind: "planned" }),
    });
    setTitle("");
    await load();
  }

  async function bump(id: string, kind: VoiceAction["kind"], progress: number) {
    await fetch(`/api/employee-voice/actions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, progressPercent: progress }),
    });
    await load();
  }

  const itemMap = new Map(items.map((i) => [i.id, i]));

  return (
    <div>
      <PageHeader
        title="Хариу арга хэмжээ"
        description="Таамагласан ажлыг төлөвлөх, гүйцэтгэлийг хянах."
        actions={
          <button type="button" className="btn btn-ghost" onClick={() => void load()}>
            <RefreshCw size={14} />
          </button>
        }
      />
      <VoiceNav />

      <section className="mb-4 grid gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] p-3 md:grid-cols-4">
        <select
          className="input"
          value={voiceId}
          onChange={(e) => setVoiceId(e.target.value)}
        >
          <option value="">Бүртгэл сонгох</option>
          {items.map((i) => (
            <option key={i.id} value={i.id}>
              {VOICE_TYPE_LABELS[i.type]} · {i.title}
            </option>
          ))}
        </select>
        <input
          className="input"
          placeholder="Арга хэмжээ"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input
          className="input"
          placeholder="Хариуцагч"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
        />
        <div className="flex gap-2">
          <input
            className="input flex-1"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
          <button type="button" className="btn btn-primary" onClick={() => void addAction()}>
            Нэмэх
          </button>
        </div>
      </section>

      <div className="overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--card)]">
        <table>
          <thead>
            <tr>
              <th>Ажил</th>
              <th>Эх бүртгэл</th>
              <th>Төрөл</th>
              <th>Явц</th>
              <th>Хугацаа</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {actions.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-sm text-[var(--muted)]">
                  Хариу арга хэмжээ алга.
                </td>
              </tr>
            ) : (
              actions.map((a) => {
                const src = itemMap.get(a.voiceId);
                return (
                  <tr key={a.id}>
                    <td>
                      <div className="font-medium">{a.title}</div>
                      <div className="text-xs text-[var(--muted)]">{a.owner || "—"}</div>
                    </td>
                    <td className="text-xs">{src?.title || "—"}</td>
                    <td>{ACTION_KIND_LABELS[a.kind]}</td>
                    <td className="tabular-nums">{a.progressPercent}%</td>
                    <td className="tabular-nums text-xs">{a.dueDate || "—"}</td>
                    <td className="whitespace-nowrap">
                      {a.kind !== "done" ? (
                        <button
                          type="button"
                          className="btn px-2 py-1 text-xs"
                          onClick={() =>
                            void bump(
                              a.id,
                              a.kind === "predicted"
                                ? "planned"
                                : a.kind === "planned"
                                  ? "in_progress"
                                  : "done",
                              a.kind === "in_progress" ? 100 : Math.min(80, a.progressPercent + 25),
                            )
                          }
                        >
                          {a.kind === "predicted"
                            ? "Төлөвлөх"
                            : a.kind === "planned"
                              ? "Эхлүүлэх"
                              : "Дуусгах"}
                        </button>
                      ) : (
                        <span className="text-xs text-emerald-700">Дууссан</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
