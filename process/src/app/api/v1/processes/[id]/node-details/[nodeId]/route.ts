import { NextResponse } from "next/server";
import { getNodeDetails } from "@/lib/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string; nodeId: string }> };

/** GET /api/v1/processes/:id/node-details/:nodeId */
export async function GET(_request: Request, ctx: Ctx) {
  const { id, nodeId } = await ctx.params;
  const details = await getNodeDetails(id, decodeURIComponent(nodeId));
  if (!details) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ data: details });
}
