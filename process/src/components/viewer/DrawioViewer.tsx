"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  /** URL that returns draw.io XML */
  xmlUrl: string;
  title?: string;
  onShapeClick?: (shapeId: string, label: string) => void;
};

/**
 * Draw.io viewer — diagrams.net embed + clickable shape list from parsed XML.
 */
export function DrawioViewer({ xmlUrl, title, onShapeClick }: Props) {
  const [xml, setXml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shapes, setShapes] = useState<{ id: string; value: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetch(xmlUrl)
      .then(async (r) => {
        if (!r.ok) throw new Error("Draw.io XML ачаалж чадсангүй");
        return r.text();
      })
      .then(async (text) => {
        if (cancelled) return;
        setXml(text);
        const { parseDrawioXml } = await import("@/lib/parse/drawio");
        const parsed = parseDrawioXml(text);
        setShapes(
          parsed.shapes
            .filter((s) => s.kind === "task" && s.value)
            .map((s) => ({ id: s.id, value: s.value })),
        );
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Load failed");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [xmlUrl]);

  const embedSrc = useMemo(() => {
    if (!xml) return null;
    // diagrams.net lightbox viewer with compressed raw XML hash
    const encoded = encodeURIComponent(xml);
    return `https://viewer.diagrams.net/?highlight=0000ff&edit=_blank&layers=1&nav=1&title=${encodeURIComponent(title || "diagram")}#R${encoded}`;
  }, [xml, title]);

  return (
    <div className="flex h-full min-h-[420px] flex-col gap-3 lg:flex-row">
      <div className="min-h-[420px] flex-1 overflow-hidden rounded-lg border border-[var(--border)] bg-white">
        {error ? (
          <div className="flex h-full items-center justify-center p-4 text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : embedSrc ? (
          <iframe
            title={title || "draw.io"}
            src={embedSrc}
            className="h-full min-h-[420px] w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--muted)]">
            Draw.io ачаалж байна…
          </div>
        )}
      </div>
      <aside className="w-full shrink-0 rounded-lg border border-[var(--border)] bg-[var(--card)] lg:w-72">
        <div className="border-b border-[var(--border)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
          Даалгавар / shapes ({shapes.length})
        </div>
        <ul className="max-h-[420px] overflow-auto p-2 text-sm">
          {shapes.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                className="w-full rounded-md px-2 py-1.5 text-left hover:bg-teal-50 dark:hover:bg-teal-950/40"
                onClick={() => onShapeClick?.(s.id, s.value)}
              >
                <div className="font-medium">{s.value}</div>
                <div className="font-mono text-[10px] text-[var(--muted)]">
                  {s.id}
                </div>
              </button>
            </li>
          ))}
          {!shapes.length && !error ? (
            <li className="px-2 py-3 text-[var(--muted)]">Shape олдсонгүй</li>
          ) : null}
        </ul>
      </aside>
    </div>
  );
}
