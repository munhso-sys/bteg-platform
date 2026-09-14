import { NextResponse } from "next/server";
import { getFile } from "@/lib/store";
import { readUploadBuffer } from "@/lib/files/storage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ fileId: string }> };

/** GET /api/v1/files/:fileId/content */
export async function GET(_request: Request, ctx: Ctx) {
  const { fileId } = await ctx.params;
  const file = await getFile(fileId);
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const buf = await readUploadBuffer(file.file_path);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": file.mime_type || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.original_name)}"`,
      "Cache-Control": "private, max-age=120",
    },
  });
}
