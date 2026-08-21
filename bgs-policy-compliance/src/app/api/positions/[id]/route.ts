import { requirePolicyMutation } from "@/lib/access/scope";
import { NextResponse } from "next/server";
import { deletePosition } from "@/lib/db/repository";

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
