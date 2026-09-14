"use client";

import { useEffect, useState } from "react";
import type { ProcessLevel, ProcessNode, ProcessNodeStatus } from "@/lib/types";
import { PROCESS_LEVEL_LABELS, PROCESS_STATUS_LABELS } from "@/lib/types";

export default function NodesPage() {
  const [nodes, setNodes] = useState<ProcessNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: "",
    title: "",
    description: "",
    level: "L3_ACTIVITY" as ProcessLevel,
    parent_id: "",
    status: "DRAFT" as ProcessNodeStatus,
  });

  async function load() {
    const res = await fetch("/api/v1/processes");
    const json = (await res.json()) as { data?: ProcessNode[]; error?: string };
    if (!res.ok) {
      setError(json.error || "Load failed");
      return;
    }
    setNodes(json.data ?? []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/processes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          parent_id: form.parent_id || null,
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Create failed");
      setForm({
        code: "",
        title: "",
        description: "",
        level: "L3_ACTIVITY",
        parent_id: "",
        status: "DRAFT",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 px-4 py-5">
      <div>
        <h1 className="text-xl font-semibold">Процессын зангилаанууд</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          CRUD · код уникал · parent hierarchy
        </p>
      </div>

      <form
        onSubmit={onCreate}
        className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 sm:grid-cols-2"
      >
        <Field label="Код">
          <input
            required
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            placeholder="ACT-MINE-03"
          />
        </Field>
        <Field label="Гарчиг">
          <input
            required
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </Field>
        <Field label="Түвшин">
          <select
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5"
            value={form.level}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                level: e.target.value as ProcessLevel,
              }))
            }
          >
            {(Object.keys(PROCESS_LEVEL_LABELS) as ProcessLevel[]).map((k) => (
              <option key={k} value={k}>
                {PROCESS_LEVEL_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Эцэг зангилаа">
          <select
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5"
            value={form.parent_id}
            onChange={(e) =>
              setForm((f) => ({ ...f, parent_id: e.target.value }))
            }
          >
            <option value="">— (үндэс)</option>
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.code} · {n.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Тайлбар" className="sm:col-span-2">
          <textarea
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5"
            rows={2}
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />
        </Field>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Хадгалж байна…" : "Зангилаа нэмэх"}
          </button>
          {error ? (
            <p className="mt-2 text-sm text-[var(--danger)]">{error}</p>
          ) : null}
        </div>
      </form>

      <div className="overflow-auto rounded-lg border border-[var(--border)] bg-[var(--card)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--background)] text-[11px] uppercase tracking-wide text-[var(--muted)]">
            <tr>
              <th className="px-3 py-2">Код</th>
              <th className="px-3 py-2">Гарчиг</th>
              <th className="px-3 py-2">Түвшин</th>
              <th className="px-3 py-2">Төлөв</th>
              <th className="px-3 py-2">Parent</th>
            </tr>
          </thead>
          <tbody>
            {nodes.map((n) => (
              <tr key={n.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2 font-mono text-xs">{n.code}</td>
                <td className="px-3 py-2">{n.title}</td>
                <td className="px-3 py-2 text-xs">
                  {PROCESS_LEVEL_LABELS[n.level]}
                </td>
                <td className="px-3 py-2 text-xs">
                  {PROCESS_STATUS_LABELS[n.status]}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-[var(--muted)]">
                  {n.parent_id ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-1 block text-xs text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}
