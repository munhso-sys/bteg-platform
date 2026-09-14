"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  xmlUrl: string;
  onElementClick?: (elementId: string, name: string) => void;
};

/**
 * BPMN 2.0 viewer via bpmn-js (client-only).
 */
export function BpmnViewer({ xmlUrl, onElementClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let viewer: {
      destroy: () => void;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      on: (event: string, fn: (e: any) => void) => void;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      get: (name: string) => any;
      importXML: (xml: string) => Promise<unknown>;
    } | null = null;
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const [{ default: BpmnJS }, xmlRes] = await Promise.all([
          import("bpmn-js/lib/NavigatedViewer"),
          fetch(xmlUrl),
        ]);
        if (!xmlRes.ok) throw new Error("BPMN XML ачаалж чадсангүй");
        const xml = await xmlRes.text();
        if (cancelled || !containerRef.current) return;

        containerRef.current.innerHTML = "";
        viewer = new BpmnJS({ container: containerRef.current });
        await viewer.importXML(xml);
        const canvas = viewer.get("canvas");
        canvas.zoom("fit-viewport");

        viewer.on("element.click", (e: { element?: { id?: string; businessObject?: { name?: string } } }) => {
          const el = e.element;
          if (!el?.id || el.id === "__implicitroot") return;
          onElementClick?.(el.id, el.businessObject?.name || el.id);
        });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "BPMN render failed");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
      try {
        viewer?.destroy();
      } catch {
        // ignore
      }
    };
  }, [xmlUrl, onElementClick]);

  return (
    <div className="relative h-full min-h-[420px] w-full overflow-hidden rounded-lg border border-[var(--border)] bg-white">
      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-[var(--muted)]">
          BPMN ачаалж байна…
        </div>
      ) : null}
      {error ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-4 text-sm text-[var(--danger)]">
          {error}
        </div>
      ) : null}
      <div ref={containerRef} className="h-full min-h-[420px] w-full" />
    </div>
  );
}
