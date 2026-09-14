import { NextResponse } from "next/server";
import { healthByNodeId } from "@/lib/analytics";
import { getDb, getTree } from "@/lib/store";
import type { ProcessNodeTree } from "@/lib/types";

export const dynamic = "force-dynamic";

function attachHealth(
  trees: ProcessNodeTree[],
  health: Record<string, string>,
): ProcessNodeTree[] {
  return trees.map((t) => ({
    ...t,
    health: (health[t.id] as ProcessNodeTree["health"]) ?? "neutral",
    children: attachHealth(t.children, health),
  }));
}

/** GET /api/v1/processes/tree — full recursive L1→L4 tree */
export async function GET() {
  const [tree, db] = await Promise.all([getTree(), getDb()]);
  const health = healthByNodeId(db);
  return NextResponse.json({ data: attachHealth(tree, health) });
}
