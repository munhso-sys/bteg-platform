import { requirePolicyMutation } from "@/lib/access/scope";
import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertJobDescriptionEvaluation } from "@/lib/db/repository";

const schema = z.object({
  job_position_id: z.string().min(1),
  evaluation_period: z.string().min(1),
  score: z.number().min(0).max(100),
  result_text: z.string().nullable().optional(),
  improvement_actions: z.string().nullable().optional(),
  conclusion: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const gate = await requirePolicyMutation();
  if (gate.error) return gate.error;
  try {
    const body = schema.parse(await req.json());
    const evaluation = await upsertJobDescriptionEvaluation({
      job_position_id: body.job_position_id,
      evaluation_period: body.evaluation_period,
      score: body.score,
      result_text: body.result_text ?? null,
      improvement_actions: body.improvement_actions ?? null,
      conclusion: body.conclusion ?? null,
    });
    return NextResponse.json({ ok: true, evaluation });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: "Буруу өгөгдөл", details: err.flatten() },
        { status: 400 },
      );
    }
    const message = err instanceof Error ? err.message : "Серверийн алдаа";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
