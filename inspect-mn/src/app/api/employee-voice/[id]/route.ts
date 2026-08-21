import { NextResponse } from "next/server";
import { requireVoiceAccess } from "@/lib/voice/access";
import { updateVoiceDb } from "@/lib/voice/store";
import type { EmployeeVoiceItem } from "@/lib/voice/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireVoiceAccess();
  if (access.error) return access.error;
  const { id } = await context.params;
  const patch = (await req.json()) as Partial<EmployeeVoiceItem>;
  let updated: EmployeeVoiceItem | null = null;
  await updateVoiceDb((db) => {
    db.items = db.items.map((item) => {
      if (item.id !== id) return item;
      updated = {
        ...item,
        ...patch,
        id: item.id,
        createdAt: item.createdAt,
        updatedAt: new Date().toISOString(),
      };
      return updated;
    });
  });
  if (!updated) {
    return NextResponse.json({ ok: false, error: "Олдсонгүй" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, item: updated });
}

export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireVoiceAccess();
  if (access.error) return access.error;
  const { id } = await context.params;
  await updateVoiceDb((db) => {
    db.items = db.items.filter((i) => i.id !== id);
    db.actions = db.actions.filter((a) => a.voiceId !== id);
    db.notices = db.notices.filter((n) => n.voiceId !== id);
  });
  return NextResponse.json({ ok: true });
}
