import { NextResponse } from "next/server";
import { runScheduledReportDistribution } from "@/lib/reports/distribution";
import { readReportDistributionConfig } from "@/lib/reports/distribution-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (process.env.NODE_ENV !== "production" && !secret) return true;
  return Boolean(secret && req.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(
      await runScheduledReportDistribution(await readReportDistributionConfig()),
    );
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Тайлан түгээхэд алдаа" },
      { status: 500 },
    );
  }
}

