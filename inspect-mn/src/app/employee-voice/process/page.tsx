"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { VoiceNav } from "@/components/voice/VoiceNav";
import type { EmployeeVoiceItem } from "@/lib/voice/types";
import { VOICE_TYPE_LABELS } from "@/lib/voice/types";

export default function VoiceProcessPage() {
  const [items, setItems] = useState<EmployeeVoiceItem[]>([]);
  const [selected, setSelected] = useState<EmployeeVoiceItem | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/employee-voice/overview", { cache: "no-store" });
    const data = await res.json();
    if (data.ok) setItems(data.db?.items ?? []);
  }

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setNote(selected?.analysisNote ?? "");
    }, 0);
    return () => window.clearTimeout(id);
  }, [selected]);

  async function saveNote() {
    if (!selected) return;
    setBusy(true);
    await fetch(`/api/employee-voice/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        analysisNote: note,
        status: selected.status === "new" ? "in_progress" : selected.status,
      }),
    });
    setBusy(false);
    await load();
  }

  const open = items.filter((i) => !["resolved", "closed", "rejected"].includes(i.status));

  return (
    <div>
      <PageHeader
        title="Боловсруулалт, шинжилгээ"
        description="Бүртгэлийг уншиж, дүгнэлт бичиж, дараагийн алхамыг тодорхойлно."
        actions={
          <button type="button" className="btn btn-ghost" onClick={() => void load()}>
            <RefreshCw size={14} />
          </button>
        }
      />
      <VoiceNav />

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--card)]">
          <table>
            <thead>
              <tr>
                <th>Бүртгэл</th>
                <th>Төрөл</th>
                <th>Таамаг</th>
              </tr>
            </thead>
            <tbody>
              {open.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(item)}
                >
                  <td className="font-medium">{item.title}</td>
                  <td>{VOICE_TYPE_LABELS[item.type]}</td>
                  <td className="text-xs text-[var(--muted)]">
                    {item.predictedAction || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <section className="rounded-md border border-[var(--border)] bg-[var(--card)] p-3">
          {selected ? (
            <div className="space-y-3 text-sm">
              <div className="font-semibold">{selected.title}</div>
              <p className="text-[var(--muted)]">{selected.description}</p>
              <div className="rounded border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-2">
                Таамагласан арга хэмжээ: {selected.predictedAction || "—"}
              </div>
              <textarea
                className="textarea min-h-28 w-full"
                placeholder="Шинжилгээ, дүгнэлт"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void saveNote()}
              >
                Дүгнэлт хадгалах
              </button>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">Зүүн жагсаалтаас сонгоно уу.</p>
          )}
        </section>
      </div>
    </div>
  );
}
