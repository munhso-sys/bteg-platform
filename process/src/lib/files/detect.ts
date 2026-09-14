import type { ProcessFileType } from "@/lib/types";

/** Heuristic: XML that looks like BPMN vs draw.io mxfile. */
export function refineXmlType(
  fileType: ProcessFileType,
  content: string,
): ProcessFileType {
  if (fileType !== "xml" && fileType !== "bpmn" && fileType !== "drawio") {
    return fileType;
  }
  const head = content.slice(0, 2000).toLowerCase();
  if (head.includes("<mxfile") || head.includes("mxgraphmodel")) {
    return "drawio";
  }
  if (
    head.includes("bpmn:") ||
    head.includes("definitions") ||
    head.includes("xmlns:bpmn")
  ) {
    return "bpmn";
  }
  return fileType === "xml" ? "xml" : fileType;
}
