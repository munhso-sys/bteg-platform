import { NextRequest, NextResponse } from "next/server";
import { requireReportsAccess } from "@/lib/reports/access";
import { buildPlatformReport } from "@/lib/reports/build";
import { renderFormalReportDocx } from "@/lib/reports/export-docx";
import { renderFormalReportPdf } from "@/lib/reports/export-pdf";
import { buildFormalReport } from "@/lib/reports/formal-report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const access = await requireReportsAccess();
  if (access.error) return access.error;

  const format = req.nextUrl.searchParams.get("format")?.toLowerCase();
  if (format !== "pdf" && format !== "docx") {
    return NextResponse.json(
      { ok: false, error: "format нь pdf эсвэл docx байна" },
      { status: 400 },
    );
  }

  const platform = await buildPlatformReport(access.unitScope);
  const report = buildFormalReport(platform);
  const date = report.generatedAt.slice(0, 10);
  const filename = `inspect-mn-formal-report-${date}.${format}`;
  const body =
    format === "pdf"
      ? await renderFormalReportPdf(report)
      : await renderFormalReportDocx(report);

  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type":
        format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

