import { requirePolicyMutation } from "@/lib/access/scope";
import { NextResponse } from "next/server";
import { z } from "zod";
import { deletePosition, updatePositionOfficialCode } from "@/lib/db/repository";

const patchSchema = z.object({
  official_code: z.string().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requirePolicyMutation();
  if (gate.error) return gate.error;
  try {
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    if (body.official_code === undefined) {
      return NextResponse.json({ ok: true });
    }
    const found = await updatePositionOfficialCode(id, body.official_code);
    if (!found) {
      return NextResponse.json(
        { ok: false, error: "Ажлын байр олдсонгүй" },
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const found = await deletePosition(id);
    if (!found) {
      return NextResponse.json(
        { ok: false, error: "Ажлын байр олдсонгүй" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Серверийн алдаа";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
