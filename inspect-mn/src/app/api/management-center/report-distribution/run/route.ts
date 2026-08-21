import { NextResponse } from "next/server";
import { requireAdminContext } from "@/lib/rbac/require-admin";
import { runScheduledReportDistribution } from "@/lib/reports/distribution";
import { readReportDistributionConfig } from "@/lib/reports/distribution-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const ctx = await requireAdminContext();
  if ("error" in ctx) return ctx.error;
  const body = (await req.json().catch(() => ({}))) as { channel?: string };
  if (body.channel !== "email" && body.channel !== "telegram") {
    return NextResponse.json({ ok: false, error: "channel нь email эсвэл telegram байна" }, { status: 400 });
  }
  try {
    const config = await readReportDistributionConfig();
    const schedule = body.channel === "email" ? config.detailedEmail : config.telegramSummary;
    if (schedule.recipients.length === 0) {
      return NextResponse.json({ ok: false, error: "Хүлээн авагч тохируулаагүй" }, { status: 400 });
    }
    return NextResponse.json(
      await runScheduledReportDistribution(config, { forceChannel: body.channel }),
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Илгээхэд алдаа" },
      { status: 500 },
    );
  }
}

