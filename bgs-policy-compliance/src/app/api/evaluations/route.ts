import { requirePolicyMutation } from "@/lib/access/scope";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createEvaluation } from "@/lib/db/repository";

const schema = z.object({
  policy_clause_id: z.string().min(1),
  job_position_id: z.string().min(1),
  responsibility_type: z.enum([
    "IMPLEMENTATION",
    "MONITORING",
    "VERIFICATION",
    "DEPLOYMENT",
  ]),
  evaluation_period: z.string().min(1),
  period_start: z.string().nullable().optional(),
  period_end: z.string().nullable().optional(),
  score: z.number().min(0).max(100),
  status: z.enum([
    "not_started",
    "in_progress",
    "partially_compliant",
    "compliant",
    "non_compliant",
    "not_applicable",
  ]),
  comment: z.string().nullable().optional(),
  evidence_text: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const gate = await requirePolicyMutation();
  if (gate.error) return gate.error;
  try {
    const json = await req.json();
    const body = schema.parse(json);
    await createEvaluation(body);
    return NextResponse.json({ ok: true }, { status: 201 });
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
