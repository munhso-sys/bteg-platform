import { requirePolicyMutation } from "@/lib/access/scope";
import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteClause, updateClause } from "@/lib/db/repository";

const patchSchema = z.object({
  text: z.string().min(1).optional(),
  reference_number: z.string().nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = patchSchema.parse(await req.json());
    const updated = await updateClause(id, body);
    if (!updated) {
      return NextResponse.json({ ok: false, error: "Зүйл олдсонгүй" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, clause: updated });
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
    const found = await deleteClause(id);
    if (!found) {
      return NextResponse.json({ ok: false, error: "Зүйл олдсонгүй" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Серверийн алдаа";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
