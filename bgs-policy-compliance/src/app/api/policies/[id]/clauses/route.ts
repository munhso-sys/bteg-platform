import { requirePolicyMutation } from "@/lib/access/scope";
import { NextResponse } from "next/server";
import { z } from "zod";
import { addClause } from "@/lib/db/repository";

const schema = z.object({
  text: z.string().trim().min(1),
  section_id: z.string().trim().min(1).nullable().optional(),
  parent_id: z.string().trim().min(1).nullable().optional(),
  reference_number: z.string().trim().min(1).nullable().optional(),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gate = await requirePolicyMutation();
  if (gate.error) return gate.error;
  try {
    const { id } = await ctx.params;
    const raw = await req.json();
    const body = schema.parse({
      ...raw,
      section_id: raw.section_id || null,
      parent_id: raw.parent_id || null,
      reference_number: raw.reference_number || null,
    });
    const clause = await addClause({ policy_id: id, ...body });
    return NextResponse.json({ ok: true, ...clause }, { status: 201 });
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
