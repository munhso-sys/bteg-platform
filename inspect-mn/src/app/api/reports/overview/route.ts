import { NextResponse } from "next/server";
import { requireReportsAccess } from "@/lib/reports/access";
import { buildPlatformReport } from "@/lib/reports/build";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const access = await requireReportsAccess();
  if (access.error) return access.error;
  const report = await buildPlatformReport(access.unitScope);
  return NextResponse.json({
    ok: true,
    ...report,
    unitScope: access.unitScope.active
      ? {
          heltesName: access.unitScope.heltesName,
          albaName: access.unitScope.albaName,
        }
      : null,
  });
}
