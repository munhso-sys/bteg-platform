import { NextResponse } from "next/server";
import { requireAdminContext } from "@/lib/rbac/require-admin";
import { normalizeReportDistributionConfig } from "@/lib/reports/distribution-config";
import {
  readReportDistributionConfig,
  writeReportDistributionConfig,
} from "@/lib/reports/distribution-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireAdminContext();
  if ("error" in ctx) return ctx.error;
  return NextResponse.json({ ok: true, config: await readReportDistributionConfig() });
}

export async function PATCH(req: Request) {
  const ctx = await requireAdminContext();
  if ("error" in ctx) return ctx.error;
  const body = (await req.json().catch(() => ({}))) as { config?: unknown };
  if (!body.config) {
    return NextResponse.json({ ok: false, error: "config шаардлагатай" }, { status: 400 });
  }
  try {
    const current = await readReportDistributionConfig();
    const incoming = normalizeReportDistributionConfig(body.config);
    const config = await writeReportDistributionConfig({
      ...incoming,
      lastEmailPeriodKey: current.lastEmailPeriodKey,
      lastTelegramPeriodKey: current.lastTelegramPeriodKey,
      lastEmailStatus: current.lastEmailStatus,
      lastTelegramStatus: current.lastTelegramStatus,
    });
    return NextResponse.json({ ok: true, config });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Хадгалахад алдаа" },
      { status: 500 },
    );
  }
}

