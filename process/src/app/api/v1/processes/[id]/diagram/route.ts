import { NextResponse } from "next/server";
import { getFile, listFiles } from "@/lib/store";
import { readUploadBuffer, readUploadText } from "@/lib/files/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/**
 * GET /api/v1/processes/:id/diagram?file_id=&format=meta|raw|text
 * Serves current diagram metadata or file content.
 */
export async function GET(request: Request, ctx: Ctx) {
  const { id: processId } = await ctx.params;
  const url = new URL(request.url);
  const fileId = url.searchParams.get("file_id");
  const format = url.searchParams.get("format") || "meta";

  const files = await listFiles(processId);
  const file = fileId
    ? files.find((f) => f.id === fileId) ?? (await getFile(fileId))
    : files.find((f) => f.is_current && ["bpmn", "drawio", "xml", "pdf"].includes(f.file_type)) ||
      files.find((f) => f.is_current);

  if (!file || file.process_id !== processId) {
    return NextResponse.json({ error: "Diagram not found" }, { status: 404 });
  }

  if (format === "meta") {
    return NextResponse.json({ data: file });
  }

  if (format === "text") {
    if (!["bpmn", "drawio", "xml", "csv"].includes(file.file_type)) {
      return NextResponse.json(
        { error: "Text format only for xml-like files" },
        { status: 400 },
      );
    }
    const text = await readUploadText(file.file_path);
    return new NextResponse(text, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "private, max-age=60",
      },
    });
  }

  // raw binary
  const buf = await readUploadBuffer(file.file_path);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": file.mime_type || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.original_name)}"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
