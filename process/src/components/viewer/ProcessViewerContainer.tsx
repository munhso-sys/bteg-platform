"use client";

import { useCallback, useEffect, useState } from "react";
import { BpmnViewer } from "@/components/viewer/BpmnViewer";
import { DrawioViewer } from "@/components/viewer/DrawioViewer";
import { MatrixTable } from "@/components/viewer/MatrixTable";
import { NodeDetailPanel } from "@/components/viewer/NodeDetailPanel";
import { PdfViewer } from "@/components/viewer/PdfViewer";
import type {
  NodeDetailsResponse,
  ProcessFile,
  ProcessMatrixRow,
} from "@/lib/types";

type Props = {
  processId: string;
  file: ProcessFile;
};

export function ProcessViewerContainer({ processId, file }: Props) {
  const [matrixRows, setMatrixRows] = useState<ProcessMatrixRow[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTitle, setPanelTitle] = useState("");
  const [details, setDetails] = useState<NodeDetailsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textUrl = `/api/v1/processes/${processId}/diagram?file_id=${file.id}&format=text`;
  const rawUrl = `/api/v1/files/${file.id}/content`;

  useEffect(() => {
    if (file.file_type !== "xlsx" && file.file_type !== "csv") return;
    let cancelled = false;
    fetch(`/api/v1/processes/${processId}/matrix?file_id=${file.id}`)
      .then(async (r) => {
        const json = (await r.json()) as {
          data?: { rows: ProcessMatrixRow[] };
        };
        if (!cancelled) setMatrixRows(json.data?.rows ?? []);
      })
      .catch(() => {
        if (!cancelled) setMatrixRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [processId, file.id, file.file_type]);

  const openNode = useCallback(
    async (diagramNodeId: string, label: string) => {
      setPanelTitle(label);
      setPanelOpen(true);
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/v1/processes/${processId}/node-details/${encodeURIComponent(diagramNodeId)}`,
        );
        const json = (await res.json()) as {
          data?: NodeDetailsResponse;
          error?: string;
        };
        if (!res.ok) throw new Error(json.error || "Load failed");
        setDetails(json.data ?? null);
      } catch (e) {
        setDetails(null);
        setError(e instanceof Error ? e.message : "Load failed");
      } finally {
        setLoading(false);
      }
    },
    [processId],
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
        <span className="rounded-md bg-[var(--background)] px-2 py-1 font-semibold uppercase">
          {file.file_type}
        </span>
        <span>
          {file.original_name} · v{file.version}
          {file.process_owner ? ` · ${file.process_owner}` : ""}
          {file.module_category ? ` · ${file.module_category}` : ""}
        </span>
      </div>

      {file.file_type === "bpmn" ||
      (file.file_type === "xml" && file.module_category === "BPMN") ? (
        <BpmnViewer xmlUrl={textUrl} onElementClick={openNode} />
      ) : null}

      {file.file_type === "drawio" ||
      (file.file_type === "xml" && file.module_category === "PFD") ? (
        <DrawioViewer
          xmlUrl={textUrl}
          title={file.original_name}
          onShapeClick={openNode}
        />
      ) : null}

      {file.file_type === "pdf" ? (
        <PdfViewer contentUrl={rawUrl} fileName={file.original_name} />
      ) : null}

      {file.file_type === "xlsx" || file.file_type === "csv" ? (
        <MatrixTable
          rows={matrixRows}
          onRowClick={(row) =>
            openNode(
              row.diagram_node_id || row.id,
              row.task_name,
            )
          }
        />
      ) : null}

      {file.file_type === "other" ? (
        <p className="text-sm text-[var(--muted)]">
          Энэ файлын viewer дэмжигдээгүй.{" "}
          <a className="text-[var(--brand)] underline" href={rawUrl}>
            Татах
          </a>
        </p>
      ) : null}

      <NodeDetailPanel
        open={panelOpen}
        title={panelTitle}
        loading={loading}
        error={error}
        details={details}
        onClose={() => setPanelOpen(false)}
      />
    </div>
  );
}
