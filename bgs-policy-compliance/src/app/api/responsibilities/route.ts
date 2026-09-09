import { requirePolicyMutation } from "@/lib/access/scope";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  upsertResponsibility,
  upsertResponsibilitiesBulk,
} from "@/lib/db/repository";

const itemSchema = z.object({
  policy_clause_id: z.string().uuid().or(z.string().min(1)),
  job_position_id: z.string().uuid().or(z.string().min(1)),
  responsibility_type: z.enum([
    "IMPLEMENTATION",
    "MONITORING",
    "VERIFICATION",
    "DEPLOYMENT",
  ]),
  weight: z.number().optional(),
  required_evidence: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const schema = z.union([
  itemSchema,
  z.object({
    items: z.array(itemSchema).min(1),
  }),
]);

export async function POST(req: Request) {
  const gate = await requirePolicyMutation();
  if (gate.error) return gate.error;
  try {
    const body = schema.parse(await req.json());
    if ("items" in body) {
      const count = await upsertResponsibilitiesBulk(body.items);
      return NextResponse.json({ ok: true, count }, { status: 201 });
    }
    await upsertResponsibility(body);
    return NextResponse.json({ ok: true, count: 1 }, { status: 201 });
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
