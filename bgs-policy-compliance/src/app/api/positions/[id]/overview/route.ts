import { NextResponse } from "next/server";
import { getPositionDetail } from "@/lib/db/repository";
import { resolveJobPositionRef } from "@/lib/access/resolve-position";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(_req.url);
    const name = searchParams.get("name");
    const resolved = await resolveJobPositionRef(id, name);
    const positionId = resolved?.id ?? id;
    const detail = await getPositionDetail(positionId);
    if (!detail) {
      return NextResponse.json(
        { ok: false, error: "Ажлын байр олдсонгүй" },
        { status: 404 },
      );
    }

    const { points: trend, snapshot } = (
      await import("@/lib/score-trend")
    ).buildPositionScoreTrend({
      complianceEvaluations: detail.evaluations,
      descriptionEvaluations: detail.descriptionEvaluations,
    });

    const overdue = detail.latestEvaluations.filter(
      (e) =>
        e.status === "non_compliant" ||
        e.status === "not_started" ||
        (typeof e.score === "number" && e.score < 50),
    ).length;

    return NextResponse.json({
      ok: true,
      position: {
        id: detail.position.id,
        name: detail.position.name,
        bteg_id: detail.position.bteg_id,
      },
      avgScore: detail.avgScore,
      evaluationCount: detail.evaluations.length,
      latestEvaluationCount: detail.latestEvaluations.length,
      overdue,
      counts: detail.counts,
      hasJobDescription: Boolean(detail.description),
      descriptionScore: detail.descriptionEvaluation?.score ?? null,
      trendSnapshot: snapshot,
      trend,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Серверийн алдаа";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
