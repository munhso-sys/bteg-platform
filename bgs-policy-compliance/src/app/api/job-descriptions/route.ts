import { requirePolicyMutation } from "@/lib/access/scope";
import { NextResponse } from "next/server";
import { z } from "zod";
import { upsertJobDescription } from "@/lib/db/repository";

const schema = z.object({
  job_position_id: z.string().min(1),
  title: z.string().nullable().optional(),
  a_code: z.string().nullable().optional(),
  job_condition: z.string().nullable().optional(),
  purpose: z.string().nullable().optional(),
  schedule: z.string().nullable().optional(),
  daily_hours: z.string().nullable().optional(),
  break_time: z.string().nullable().optional(),
  duties: z.array(z.string()).optional(),
  education_level: z.string().nullable().optional(),
  work_experience: z.string().nullable().optional(),
  general_skills: z.array(z.string()).optional(),
  professional_skills: z.array(z.string()).optional(),
  authority: z.string().nullable().optional(),
  responsibilities: z.string().nullable().optional(),
  relevant_laws: z.array(z.string()).optional(),
  resources: z.string().nullable().optional(),
  communication_scope: z.unknown().optional(),
});

export async function POST(req: Request) {
  const gate = await requirePolicyMutation();
  if (gate.error) return gate.error;
  try {
    const body = schema.parse(await req.json());
    await upsertJobDescription(body);
    return NextResponse.json({ ok: true });
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
