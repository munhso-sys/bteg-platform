import { requirePolicyMutation } from "@/lib/access/scope";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createEvaluation,
  createEvaluationsBulk,
} from "@/lib/db/repository";

/** Large company-scope scores need one remote write, not N sequential ones. */
export const maxDuration = 60;

const schema = z.object({
  policy_clause_id: z.string().min(1).optional(),
  policy_clause_ids: z.array(z.string().min(1)).optional(),
  job_position_id: z.string().min(1).optional(),
  job_position_ids: z.array(z.string().min(1)).optional(),
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
  exclude_from_average: z.boolean().optional(),
}).superRefine((body, ctx) => {
  if (body.exclude_from_average === true) {
    const comment = (body.comment ?? "").trim();
    if (!comment) {
      ctx.addIssue({
        code: "custom",
        path: ["comment"],
        message: "Дундажаас хасах үед тайлбар заавал шаардлагатай",
      });
    }
  }
});

export async function POST(req: Request) {
  const gate = await requirePolicyMutation();
  if (gate.error) return gate.error;
  try {
    const json = await req.json();
    const body = schema.parse(json);
    const clauseIds = [
      ...new Set(
        [
          ...(body.policy_clause_ids ?? []),
          ...(body.policy_clause_id ? [body.policy_clause_id] : []),
        ].filter(Boolean),
      ),
    ];
    const positionIds = [
      ...new Set(
        [
          ...(body.job_position_ids ?? []),
          ...(body.job_position_id ? [body.job_position_id] : []),
        ].filter(Boolean),
      ),
    ];
    if (!clauseIds.length) {
      return NextResponse.json(
        { ok: false, error: "Зүйл сонгоно уу" },
        { status: 400 },
      );
    }
    if (!positionIds.length) {
      return NextResponse.json(
        { ok: false, error: "Ажлын байр сонгоно уу" },
        { status: 400 },
      );
    }

    // One position → single write. Many positions/clauses → one bulk updateDb
    // (N× createEvaluation caused 504 on ~193 company-scope scores).
    let count = 0;
    if (clauseIds.length === 1 && positionIds.length === 1) {
      await createEvaluation({
        policy_clause_id: clauseIds[0],
        job_position_id: positionIds[0],
        responsibility_type: body.responsibility_type,
        evaluation_period: body.evaluation_period,
        period_start: body.period_start,
        period_end: body.period_end,
        score: body.score,
        status: body.status,
        comment: body.comment,
        evidence_text: body.evidence_text,
        exclude_from_average: body.exclude_from_average === true,
      });
      count = 1;
    } else {
      count = await createEvaluationsBulk({
        policy_clause_ids: clauseIds,
        job_position_ids: positionIds,
        responsibility_type: body.responsibility_type,
        evaluation_period: body.evaluation_period,
        period_start: body.period_start,
        period_end: body.period_end,
        score: body.score,
        status: body.status,
        comment: body.comment,
        evidence_text: body.evidence_text,
        exclude_from_average: body.exclude_from_average === true,
        ensureLinks: clauseIds.length === 1,
      });
    }

    return NextResponse.json({ ok: true, count }, { status: 201 });
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
