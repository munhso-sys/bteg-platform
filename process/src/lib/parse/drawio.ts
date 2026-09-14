/**
 * Lightweight draw.io (mxfile) parser — extract shapes for DFD mapping.
 */

export type DrawioShape = {
  id: string;
  value: string;
  kind: "task" | "swimlane" | "gateway" | "event" | "note" | "edge" | "other";
  style: string;
  parent: string | null;
  source: string | null;
  target: string | null;
};

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function classify(style: string, isEdge: boolean): DrawioShape["kind"] {
  if (isEdge) return "edge";
  const s = style.toLowerCase();
  if (s.includes("swimlane")) return "swimlane";
  if (s.includes("shape=note") || s.includes("shape=mxgraph.basic.note")) {
    return "note";
  }
  if (s.includes("ellipse") || s.includes("shape=mxgraph.bpmn.event")) {
    return "event";
  }
  if (s.includes("rhombus") || s.includes("gateway") || s.includes("bpmn")) {
    if (s.includes("gateway") || s.includes("rhombus")) return "gateway";
  }
  if (s.includes("rounded=1") || s.includes("whiteSpace=wrap")) return "task";
  return "other";
}

/** Parse mxCell elements from draw.io XML text. */
export function parseDrawioXml(xml: string): {
  diagramName: string | null;
  shapes: DrawioShape[];
  taskIds: string[];
} {
  const nameMatch = /<diagram[^>]*\sname="([^"]*)"/i.exec(xml);
  const diagramName = nameMatch?.[1] ?? null;

  const shapes: DrawioShape[] = [];
  const cellRe =
    /<mxCell\b([^>]*)\/>|<mxCell\b([^>]*)>([\s\S]*?)<\/mxCell>/gi;
  let m: RegExpExecArray | null;
  while ((m = cellRe.exec(xml))) {
    const attrs = m[1] || m[2] || "";
    const id = /(?:^|\s)id="([^"]*)"/.exec(attrs)?.[1];
    if (!id || id === "0" || id === "1") continue;
    const valueRaw = /(?:^|\s)value="([^"]*)"/.exec(attrs)?.[1] ?? "";
    const style = /(?:^|\s)style="([^"]*)"/.exec(attrs)?.[1] ?? "";
    const parent = /(?:^|\s)parent="([^"]*)"/.exec(attrs)?.[1] ?? null;
    const source = /(?:^|\s)source="([^"]*)"/.exec(attrs)?.[1] ?? null;
    const target = /(?:^|\s)target="([^"]*)"/.exec(attrs)?.[1] ?? null;
    const isEdge = /\bedge="1"/.test(attrs) || Boolean(source && target);
    const isVertex = /\bvertex="1"/.test(attrs);
    if (!isEdge && !isVertex) continue;

    const value = stripHtml(
      valueRaw
        .replace(/&quot;/g, '"')
        .replace(/&#xa;/gi, " ")
        .replace(/&#x([0-9a-f]+);/gi, (_, h) =>
          String.fromCharCode(parseInt(h, 16)),
        ),
    );

    shapes.push({
      id,
      value,
      kind: classify(style, isEdge),
      style,
      parent,
      source,
      target,
    });
  }

  const taskIds = shapes
    .filter((s) => s.kind === "task" && s.value)
    .map((s) => s.id);

  return { diagramName, shapes, taskIds };
}
