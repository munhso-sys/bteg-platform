import { NextResponse } from "next/server";
import { getDb } from "@/lib/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/v1/processes/:id/matrix?file_id= */
export async function GET(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const fileId = new URL(request.url).searchParams.get("file_id");
  const db = await getDb();
  let rows = db.matrix_rows.filter((r) => r.process_id === id);
  if (fileId) rows = rows.filter((r) => r.file_id === fileId);
  const docs = db.matrix_docs.filter((d) => d.process_id === id);
  return NextResponse.json({
    data: { rows, docs },
  });
}
