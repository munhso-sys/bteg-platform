import { requirePolicyMutation } from "@/lib/access/scope";
import { NextResponse } from "next/server";
import { z } from "zod";
import { updateEvaluationAttention } from "@/lib/db/repository";

const schema = z.object({
  comment: z.string().nullable().optional(),
  evidence_text: z.string().nullable().optional(),
  exclude_from_average: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requirePolicyMutation();
  if (gate.error) return gate.error;
  try {
    const { id } = await params;
    const body = schema.parse(await req.json());
    if (
      body.exclude_from_average === true &&
      !(body.comment ?? "").trim()
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "Дундажаас хасах үед тайлбар заавал шаардлагатай",
        },
        { status: 400 },
      );
    }
    const ok = await updateEvaluationAttention(id, body);
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "Үнэлгээ олдсонгүй" },
        { status: 404 },
      );
    }
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
