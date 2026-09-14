"use client";

import { X } from "lucide-react";
import type { NodeDetailsResponse } from "@/lib/types";

type Props = {
  open: boolean;
  title: string;
  loading?: boolean;
  error?: string | null;
  details: NodeDetailsResponse | null;
  onClose: () => void;
};

export function NodeDetailPanel({
  open,
  title,
  loading,
  error,
  details,
  onClose,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[var(--border)] bg-[var(--card)] shadow-2xl">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            DFD · RACI · Matrix
          </div>
          <h2 className="truncate text-lg font-semibold">{title}</h2>
          {details ? (
            <div className="font-mono text-[11px] text-[var(--muted)]">
              {details.diagram_node_id}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          className="rounded-md p-2 text-[var(--muted)] hover:bg-black/5"
          onClick={onClose}
          aria-label="Хаах"
        >
          <X size={18} />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto px-4 py-3 text-sm">
        {loading ? <p className="text-[var(--muted)]">Ачаалж байна…</p> : null}
        {error ? <p className="text-[var(--danger)]">{error}</p> : null}

        {details?.dfd?.length ? (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase text-[var(--muted)]">
              DFD mapping
            </h3>
            <ul className="space-y-2">
              {details.dfd.map((d) => (
                <li
                  key={d.id}
                  className="rounded-md border border-[var(--border)] px-3 py-2"
                >
                  <div className="font-medium">
                    {d.label}{" "}
                    <span className="text-xs text-[var(--muted)]">
                      ({d.element_kind} · {d.dfd_level})
                    </span>
                  </div>
                  <div className="mt-1 text-xs">
                    <div>
                      <span className="text-[var(--muted)]">In:</span>{" "}
                      {d.data_input.join(", ") || "—"}
                    </div>
                    <div>
                      <span className="text-[var(--muted)]">Out:</span>{" "}
                      {d.data_output.join(", ") || "—"}
                    </div>
                    {d.data_store_reference ? (
                      <div>
                        <span className="text-[var(--muted)]">Store:</span>{" "}
                        {d.data_store_reference}
                      </div>
                    ) : null}
                    {d.api_payload_schema ? (
                      <pre className="mt-1 max-h-32 overflow-auto rounded bg-[var(--background)] p-2 text-[10px]">
                        {d.api_payload_schema}
                      </pre>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          !loading && (
            <p className="text-xs text-[var(--muted)]">
              DFD холбоос байхгүй — Documents дээр map хийнэ үү.
            </p>
          )
        )}

        {details?.raci?.length ? (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase text-[var(--muted)]">
              RACI
            </h3>
            <ul className="space-y-2">
              {details.raci.map((r) => (
                <li
                  key={r.id}
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-xs"
                >
                  <div className="font-medium text-sm">{r.title}</div>
                  <div>R: {r.responsible_role || "—"}</div>
                  <div>A: {r.accountable_role || "—"}</div>
                  <div>C: {r.consulted_role || "—"}</div>
                  <div>I: {r.informed_role || "—"}</div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {details?.matrix_rows?.length ? (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase text-[var(--muted)]">
              Matrix / IPO
            </h3>
            <ul className="space-y-2">
              {details.matrix_rows.slice(0, 12).map((m) => (
                <li
                  key={m.id}
                  className="rounded-md border border-[var(--border)] px-3 py-2 text-xs"
                >
                  <div className="font-medium text-sm">{m.task_name}</div>
                  <div>Оролт: {m.input_data || "—"}</div>
                  <div>Гаралт: {m.output_data || "—"}</div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {details?.files?.length ? (
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase text-[var(--muted)]">
              Attachments
            </h3>
            <ul className="space-y-1 text-xs">
              {details.files.map((f) => (
                <li key={f.id}>
                  {f.original_name} · v{f.version} · {f.file_type}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
