import { NextResponse } from "next/server";
import { listFiles, revertFileVersion } from "@/lib/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/v1/processes/:id/files */
export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const files = await listFiles(id);
  return NextResponse.json({ data: files });
}

/** POST /api/v1/processes/:id/files  { action: "revert", file_id } */
export async function POST(request: Request, ctx: Ctx) {
  await ctx.params;
  let body: { action?: string; file_id?: string };
  try {
    body = (await request.json()) as { action?: string; file_id?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.action !== "revert" || !body.file_id) {
    return NextResponse.json(
      { error: "Expected { action: 'revert', file_id }" },
      { status: 400 },
    );
  }
  try {
    const file = await revertFileVersion(body.file_id);
    return NextResponse.json({ data: file });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Revert failed";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
