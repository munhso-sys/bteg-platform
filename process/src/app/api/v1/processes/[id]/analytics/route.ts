import { NextResponse } from "next/server";
import { computeAnalytics } from "@/lib/analytics";
import { getDb } from "@/lib/store";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/v1/processes/:id/analytics — subtree aggregates */
export async function GET(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const db = await getDb();
  const analytics = computeAnalytics(db, id);
  if (!analytics) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ data: analytics });
}
