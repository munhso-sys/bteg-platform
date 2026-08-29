import { requirePolicyMutation } from "@/lib/access/scope";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createAlbaUnit,
  createHeltesUnit,
  listOrgAssignTree,
} from "@/lib/db/org";

const createSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("heltes"),
    name: z.string().trim().min(1),
    alba_name: z.string().trim().min(1).nullable().optional(),
  }),
  z.object({
    kind: z.literal("alba"),
    heltes_id: z.string().trim().min(1),
    name: z.string().trim().min(1),
  }),
]);

export async function GET() {
  try {
    const tree = await listOrgAssignTree();
    return NextResponse.json({ ok: true, tree });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Серверийн алдаа";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const gate = await requirePolicyMutation();
  if (gate.error) return gate.error;
  try {
    const body = createSchema.parse(await req.json());
    if (body.kind === "heltes") {
      const created = await createHeltesUnit({
        name: body.name,
        alba_name: body.alba_name,
      });
      return NextResponse.json({ ok: true, ...created }, { status: 201 });
    }
    const created = await createAlbaUnit({
      heltes_id: body.heltes_id,
      name: body.name,
    });
    return NextResponse.json({ ok: true, ...created }, { status: 201 });
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
