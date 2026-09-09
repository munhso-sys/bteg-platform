import { requirePolicyMutation } from "@/lib/access/scope";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deactivateResponsibilities,
  deactivateResponsibilitiesByScope,
} from "@/lib/db/repository";

const schema = z
  .object({
    ids: z.array(z.string().min(1)).optional(),
    policy_id: z.string().min(1).optional(),
    section_id: z.string().min(1).optional(),
    clause_id: z.string().min(1).optional(),
  })
  .refine(
    (b) =>
      (b.ids && b.ids.length > 0) ||
      !!b.policy_id ||
      !!b.section_id ||
      !!b.clause_id,
    { message: "Холбоос эсвэл хамрах хүрээ заана уу" },
  );

export async function POST(req: Request) {
  const gate = await requirePolicyMutation();
  if (gate.error) return gate.error;
  try {
    const body = schema.parse(await req.json());
    let count = 0;
    if (body.ids?.length) {
      count = await deactivateResponsibilities(body.ids);
    } else {
      count = await deactivateResponsibilitiesByScope({
        policy_id: body.policy_id,
        section_id: body.section_id,
        clause_id: body.clause_id,
      });
    }
    return NextResponse.json({ ok: true, count });
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
