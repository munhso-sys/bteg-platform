"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ProcessViewerContainer } from "@/components/viewer/ProcessViewerContainer";
import type { ProcessFile, ProcessNode } from "@/lib/types";

export default function DocumentsPage() {
  const [nodes, setNodes] = useState<ProcessNode[]>([]);
  const [processId, setProcessId] = useState("");
  const [files, setFiles] = useState<ProcessFile[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [owner, setOwner] = useState("");
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dfdNodeId, setDfdNodeId] = useState("");
  const [dfdLabel, setDfdLabel] = useState("");
  const [dfdIn, setDfdIn] = useState("");
  const [dfdOut, setDfdOut] = useState("");

  const loadNodes = useCallback(async () => {
    const res = await fetch("/api/v1/processes");
    const json = (await res.json()) as { data?: ProcessNode[] };
    const list = json.data ?? [];
    setNodes(list);
    if (!processId && list[0]) setProcessId(list[0].id);
  }, [processId]);

  const loadFiles = useCallback(async (pid: string) => {
    if (!pid) return;
    const res = await fetch(`/api/v1/processes/${pid}/files`);
    const json = (await res.json()) as { data?: ProcessFile[] };
    const list = json.data ?? [];
    setFiles(list);
    const current = list.find((f) => f.is_current) ?? list[0];
    setSelectedFileId(current?.id ?? null);
  }, []);

  useEffect(() => {
    void loadNodes();
  }, [loadNodes]);

  useEffect(() => {
    if (processId) void loadFiles(processId);
  }, [processId, loadFiles]);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !processId) return;
    setUploading(true);
    setError(null);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("process_id", processId);
      if (owner) fd.set("process_owner", owner);
      fd.set("new_version", "1");
      const res = await fetch("/api/v1/processes/upload", {
        method: "POST",
        body: fd,
      });
      const json = (await res.json()) as {
        error?: string;
        data?: { file: ProcessFile; matrix_rows_count: number };
      };
      if (!res.ok) throw new Error(json.error || "Upload failed");
      setMessage(
        `Амжилттай: ${json.data?.file.original_name} v${json.data?.file.version}` +
          (json.data?.matrix_rows_count
            ? ` · ${json.data.matrix_rows_count} matrix мөр`
            : ""),
      );
      await loadFiles(processId);
      setSelectedFileId(json.data?.file.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function onRevert(fileId: string) {
    const res = await fetch(`/api/v1/processes/${processId}/files`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "revert", file_id: fileId }),
    });
    if (res.ok) await loadFiles(processId);
  }

  async function onDfdMap(e: React.FormEvent) {
    e.preventDefault();
    if (!processId || !dfdNodeId || !dfdLabel) return;
    setError(null);
    const res = await fetch(`/api/v1/processes/${processId}/dfd-map`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        maps: [
          {
            diagram_node_id: dfdNodeId,
            label: dfdLabel,
            dfd_level: "L1_FLOW",
            element_kind: "PROCESS",
            data_input: dfdIn
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            data_output: dfdOut
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            data_store_reference: null,
            api_payload_schema: null,
            data_dictionary: {},
            notes: null,
            file_id: selectedFileId,
          },
        ],
      }),
    });
    const json = (await res.json()) as { error?: string };
    if (!res.ok) {
      setError(json.error || "DFD map failed");
      return;
    }
    setMessage(`DFD map хадгаллаа: ${dfdLabel}`);
  }

  const selected = files.find((f) => f.id === selectedFileId) ?? null;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Диаграмм · баримт</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            BPMN / Draw.io / PDF / Excel upload · viewer · DFD map · versioning
          </p>
        </div>
        <Link
          href="/processes"
          className="text-sm text-[var(--brand)] hover:underline"
        >
          Процессын зураг →
        </Link>
      </div>

      <div className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 lg:grid-cols-4">
        <label className="text-xs">
          <span className="mb-1 block text-[var(--muted)]">Процесс</span>
          <select
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
            value={processId}
            onChange={(e) => setProcessId(e.target.value)}
          >
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.code} · {n.title}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-[var(--muted)]">Process owner</span>
          <input
            className="w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5 text-sm"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
            placeholder="Жишээ: ХММЗА"
          />
        </label>
        <label className="text-xs lg:col-span-2">
          <span className="mb-1 block text-[var(--muted)]">
            Файл оруулах (.bpmn .drawio .xml .pdf .xlsx .csv)
          </span>
          <input
            type="file"
            accept=".bpmn,.drawio,.xml,.pdf,.xlsx,.xls,.csv"
            disabled={!processId || uploading}
            onChange={onUpload}
            className="block w-full text-sm"
          />
        </label>
      </div>

      {message ? (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">{message}</p>
      ) : null}
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-lg border border-[var(--border)] bg-[var(--card)]">
          <div className="border-b border-[var(--border)] px-3 py-2 text-xs font-semibold uppercase text-[var(--muted)]">
            Файлууд ({files.length})
          </div>
          <ul className="max-h-[520px] overflow-auto p-2 text-sm">
            {files.map((f) => (
              <li key={f.id} className="mb-1">
                <button
                  type="button"
                  onClick={() => setSelectedFileId(f.id)}
                  className={`w-full rounded-md px-2 py-2 text-left ${
                    selectedFileId === f.id
                      ? "bg-teal-50 dark:bg-teal-950/40"
                      : "hover:bg-black/5"
                  }`}
                >
                  <div className="font-medium leading-snug">
                    {f.original_name}
                    {f.is_current ? (
                      <span className="ml-1 text-[10px] text-emerald-600">
                        current
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[11px] text-[var(--muted)]">
                    {f.file_type} · v{f.version} ·{" "}
                    {Math.round(f.size_bytes / 1024)} KB
                  </div>
                </button>
                {!f.is_current ? (
                  <button
                    type="button"
                    className="px-2 text-[11px] text-[var(--brand)] hover:underline"
                    onClick={() => void onRevert(f.id)}
                  >
                    Энэ хувилбарт буцах
                  </button>
                ) : null}
              </li>
            ))}
            {!files.length ? (
              <li className="px-2 py-4 text-[var(--muted)]">
                Файл байхгүй. Desktop PFD-ээс .drawio / .xlsx / .pdf оруулна уу.
              </li>
            ) : null}
          </ul>

          <form
            onSubmit={onDfdMap}
            className="space-y-2 border-t border-[var(--border)] p-3 text-xs"
          >
            <div className="font-semibold uppercase text-[var(--muted)]">
              DFD map
            </div>
            <input
              className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1"
              placeholder="diagram node id"
              value={dfdNodeId}
              onChange={(e) => setDfdNodeId(e.target.value)}
            />
            <input
              className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1"
              placeholder="Label"
              value={dfdLabel}
              onChange={(e) => setDfdLabel(e.target.value)}
            />
            <input
              className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1"
              placeholder="Input data (таслалаар)"
              value={dfdIn}
              onChange={(e) => setDfdIn(e.target.value)}
            />
            <input
              className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1"
              placeholder="Output data (таслалаар)"
              value={dfdOut}
              onChange={(e) => setDfdOut(e.target.value)}
            />
            <button
              type="submit"
              className="rounded-md bg-[var(--brand)] px-3 py-1.5 font-medium text-white"
            >
              Хадгалах
            </button>
          </form>
        </aside>

        <section className="min-h-[480px] rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
          {selected && processId ? (
            <ProcessViewerContainer processId={processId} file={selected} />
          ) : (
            <p className="p-6 text-sm text-[var(--muted)]">
              Файл сонгоно уу эсвэл шинээр upload хийнэ үү.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
