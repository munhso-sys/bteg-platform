import { requirePolicyMutation } from "@/lib/access/scope";
import { NextResponse } from "next/server";
import { z } from "zod";
import { setPolicyOrgAssignment } from "@/lib/db/org";
import { getDb } from "@/lib/db/repository";

const schema = z.object({
  heltes_id: z.string().min(1),
  alba_id: z.string().min(1),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = schema.parse(await req.json());
    const db = await getDb();
    const policy = db.policies.find((p) => p.id === id && !p.is_deleted);
    if (!policy) {
      return NextResponse.json(
        { ok: false, error: "Журам олдсонгүй" },
        { status: 404 },
      );
    }
    await setPolicyOrgAssignment({
      policy_id: id,
      policy_name: policy.name,
      heltes_id: body.heltes_id,
      alba_id: body.alba_id,
    });
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
