import { NextResponse } from "next/server";
import {
  getAlbaContext,
  listAlbaPolicies,
  listAlbaPositions,
} from "@/lib/db/org";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const heltesId = searchParams.get("heltesId");
    const albaId = searchParams.get("albaId");
    const tab = searchParams.get("tab") === "positions" ? "positions" : "policies";
    if (!heltesId || !albaId) {
      return NextResponse.json(
        { ok: false, error: "heltesId, albaId шаардлагатай" },
        { status: 400 },
      );
    }

    const ctx = await getAlbaContext(heltesId, albaId);
    if (!ctx.heltes || !ctx.alba) {
      return NextResponse.json({ ok: false, error: "Нэгж олдсонгүй" }, { status: 404 });
    }

    if (tab === "positions") {
      const positions = await listAlbaPositions(heltesId, albaId);
      return NextResponse.json({
        ok: true,
        tab,
        heltes: { id: ctx.heltes.bteg_id, name: ctx.heltes.name },
        alba: { id: ctx.alba.bteg_id, name: ctx.alba.name },
        positions: positions.map((r) => ({
          id: r.position.id,
          name: r.position.name,
          bteg_id: r.position.bteg_id,
          has_job_description: r.has_job_description,
          obligation_count: r.obligation_count,
          avg_score: r.avg_score,
        })),
      });
    }

    const policies = await listAlbaPolicies(heltesId, albaId);
    return NextResponse.json({
      ok: true,
      tab,
      heltes: { id: ctx.heltes.bteg_id, name: ctx.heltes.name },
      alba: { id: ctx.alba.bteg_id, name: ctx.alba.name },
      policies: policies.map((r) => ({
        id: r.policy.id,
        name: r.policy.name,
        reference_code: r.policy.reference_code,
        approved_date: r.policy.approved_date,
        clause_count: r.clause_count,
        linked_position_count: r.linked_position_count,
        evaluation_count: r.evaluation_count,
        avg_score: r.avg_score,
        scope_label: r.scope_label,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Серверийн алдаа";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
