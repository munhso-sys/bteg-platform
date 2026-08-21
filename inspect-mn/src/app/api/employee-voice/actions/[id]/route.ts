import { NextResponse } from "next/server";
import { requireVoiceAccess } from "@/lib/voice/access";
import { updateVoiceDb } from "@/lib/voice/store";
import type { VoiceAction } from "@/lib/voice/types";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const access = await requireVoiceAccess();
  if (access.error) return access.error;
  const { id } = await context.params;
  const patch = (await req.json()) as Partial<VoiceAction>;
  let updated: VoiceAction | null = null;
  await updateVoiceDb((db) => {
    db.actions = db.actions.map((a) => {
      if (a.id !== id) return a;
      updated = { ...a, ...patch, id: a.id, createdAt: a.createdAt, updatedAt: new Date().toISOString() };
      return updated;
    });
  });
  if (!updated) {
    return NextResponse.json({ ok: false, error: "Олдсонгүй" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, action: updated });
}
