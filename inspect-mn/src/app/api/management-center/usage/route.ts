import { NextResponse } from "next/server";
import { requireAdminContext } from "@/lib/rbac/require-admin";
import {
  buildUsageTree,
  filterEvents,
  readUsageEvents,
} from "@/lib/usage/local-store";
import type { UsageEventKind } from "@/lib/usage/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ctx = await requireAdminContext();
  if (ctx.error) return ctx.error;

  const url = new URL(request.url);
  const kind = (url.searchParams.get("kind") || "all") as
    | UsageEventKind
    | "all";
  const events = filterEvents(await readUsageEvents(3000), kind);
  const tree = buildUsageTree(events);

  const totals = {
    events: events.length,
    logins: events.filter((e) => e.kind === "login").length,
    moduleViews: events.filter((e) => e.kind === "module_view").length,
    openaiCalls: events.filter((e) => e.kind === "openai").length,
    totalTokens: events.reduce((sum, e) => sum + (e.totalTokens ?? 0), 0),
  };

  return NextResponse.json({
    ok: true,
    storage: "local-fs",
    note: "Events are stored under inspect-mn/data/usage (not Production Supabase).",
    totals,
    tree,
    recent: [...events].reverse().slice(0, 40),
  });
}
