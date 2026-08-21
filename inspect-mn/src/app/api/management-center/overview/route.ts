import { NextResponse } from "next/server";
import { requireAdminContext } from "@/lib/rbac/require-admin";
import { buildManagementOverview } from "@/lib/management-center/overview";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireAdminContext();
  if ("error" in ctx) return ctx.error;

  try {
    const overview = await buildManagementOverview(ctx.admin);
    return NextResponse.json({ ok: true, ...overview });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Overview алдаа",
      },
      { status: 500 },
    );
  }
}
