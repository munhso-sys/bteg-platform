"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { VoiceNav } from "@/components/voice/VoiceNav";
import { VoiceFormModal } from "@/components/voice/VoiceFormModal";
import { PriorityBadge, StatusBadge } from "@/components/ui/StatusBadge";
import type { EmployeeVoiceItem, VoiceType } from "@/lib/voice/types";
import {
  VOICE_STATUS_LABELS,
  VOICE_TYPE_LABELS,
} from "@/lib/voice/types";
import type { RowStatus } from "@/lib/placeholder-data";

const FILTERS: { id: "all" | VoiceType | "telegram"; label: string }[] = [
  { id: "all", label: "Бүгд" },
  { id: "telegram", label: "Telegram" },
  { id: "suggestion", label: "Санал" },
  { id: "request", label: "Хүсэлт" },
  { id: "complaint", label: "Гомдол" },
  { id: "survey", label: "Асуулга" },
];

function rowStatus(status: string): RowStatus {
  if (status === "resolved" || status === "closed") return "done";
  if (status === "in_progress" || status === "planned") return "in_progress";
  if (status === "rejected") return "overdue";
  return "open";
}

export default function VoiceInboxPage() {
  const [items, setItems] = useState<EmployeeVoiceItem[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<EmployeeVoiceItem | null | "new">(null);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    setError("");
    const res = await fetch("/api/employee-voice", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      setError(data.error || "Ачаалахад алдаа");
      return;
    }
    setItems(data.items ?? []);
  }

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  async function removeItem(item: EmployeeVoiceItem) {
    const ok = window.confirm(
      `«${item.title.slice(0, 80)}${item.title.length > 80 ? "…" : ""}» бүртгэлийг устгах уу?`,
    );
    if (!ok) return;
    setDeletingId(item.id);
    setError("");
    try {
      const res = await fetch(`/api/employee-voice/${item.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Устгахад алдаа");
        return;
      }
      setItems((prev) => prev.filter((i) => i.id !== item.id));
      if (editing && editing !== "new" && editing.id === item.id) {
        setEditing(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Устгахад алдаа");
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === "telegram" && item.source !== "telegram") return false;
      if (filter !== "all" && filter !== "telegram" && item.type !== filter) {
        return false;
      }
      if (!q) return true;
      return `${item.title} ${item.description} ${item.department} ${item.submittedBy}`
        .toLowerCase()
        .includes(q);
    });
  }, [items, filter, query]);

  return (
    <div>
      <PageHeader
        title="Бүртгэл"
        description="Санал, хүсэлт, гомдол, асуулга хүлээн авах, засах."
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => void load()}>
              <RefreshCw size={14} />
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setEditing("new")}
            >
              <Plus size={14} /> Шинэ
            </button>
          </>
        }
      />
      <VoiceNav />
      {error ? <p className="mb-3 text-sm text-rose-700">{error}</p> : null}

      <div className="mb-3 flex flex-col gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`shrink-0 rounded px-3 py-2 text-xs font-medium ${
                filter === f.id
                  ? "bg-[var(--brand)] text-white"
                  : "border border-[var(--border)]"
              }`}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          className="input sm:w-56"
          placeholder="Хайх"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="overflow-x-auto rounded-md border border-[var(--border)] bg-[var(--card)]">
        <table>
          <thead>
            <tr>
              <th>Гарчиг</th>
              <th>Төрөл</th>
              <th>Төлөв</th>
              <th>Зэрэг</th>
              <th>Нэгж</th>
              <th>Эх</th>
              <th className="w-12 text-right"> </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-sm text-[var(--muted)]">
                  Бүртгэл алга. Telegram эсвэл «Шинэ»-ээр оруулна.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr
                  key={item.id}
                  className="cursor-pointer"
                  onClick={() => setEditing(item)}
                >
                  <td>
                    <div className="font-medium">{item.title}</div>
                    {item.description &&
                    item.description.replace(/\s+/g, " ").trim() !==
                      item.title.replace(/\s+/g, " ").trim() ? (
                      <div className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs text-[var(--muted)]">
                        {item.description}
                      </div>
                    ) : null}
                    <div className="text-xs text-[var(--muted)]">
                      {item.isAnonymous ? "Нэргүй" : item.submittedBy || "—"}
                    </div>
                  </td>
                  <td>{VOICE_TYPE_LABELS[item.type]}</td>
                  <td>
                    <StatusBadge status={rowStatus(item.status)} />
                    <span className="sr-only">{VOICE_STATUS_LABELS[item.status]}</span>
                  </td>
                  <td>
                    <PriorityBadge
                      priority={
                        item.priority === "critical" || item.priority === "high"
                          ? "high"
                          : item.priority === "low"
                            ? "low"
                            : "medium"
                      }
                    />
                  </td>
                  <td>{item.department || "—"}</td>
                  <td>{item.source === "telegram" ? "Telegram" : "Вэб"}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      className="btn btn-ghost px-2 py-1 text-rose-700 hover:bg-rose-50"
                      title="Устгах"
                      aria-label="Устгах"
                      disabled={deletingId === item.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        void removeItem(item);
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {editing ? (
        <VoiceFormModal
          item={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => void load()}
        />
      ) : null}
    </div>
  );
}
