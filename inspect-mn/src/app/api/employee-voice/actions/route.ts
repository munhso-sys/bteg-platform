import { NextResponse } from "next/server";
import { requireVoiceAccess } from "@/lib/voice/access";
import { newId, readVoiceDb, updateVoiceDb } from "@/lib/voice/store";
import { overviewFromDb } from "@/lib/voice/overview";
import { filterVoiceDbByUnit } from "@/lib/voice/unit-filter";
import type { ActionKind, VoiceAction } from "@/lib/voice/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireVoiceAccess();
  if (access.error) return access.error;
  const raw = await readVoiceDb();
  const db = filterVoiceDbByUnit(raw, access.unitScope);
  return NextResponse.json({ ok: true, overview: overviewFromDb(db), ...db });
}

export async function POST(req: Request) {
  const access = await requireVoiceAccess();
  if (access.error) return access.error;
  const body = (await req.json()) as Partial<VoiceAction>;
  if (!body.voiceId || !body.title?.trim()) {
    return NextResponse.json(
      { ok: false, error: "voiceId болон title шаардлагатай" },
      { status: 400 },
    );
  }
  const now = new Date().toISOString();
  const action: VoiceAction = {
    id: newId(),
    voiceId: body.voiceId,
    title: body.title.trim(),
    kind: (body.kind as ActionKind) || "planned",
    owner: body.owner?.trim() || "",
    dueDate: body.dueDate || null,
    progressPercent: Number(body.progressPercent || 0),
    note: body.note || "",
    createdAt: now,
    updatedAt: now,
  };
  await updateVoiceDb((db) => {
    db.actions.unshift(action);
    db.items = db.items.map((item) =>
      item.id === action.voiceId
        ? { ...item, status: item.status === "new" ? "planned" : item.status, updatedAt: now }
        : item,
    );
  });
  return NextResponse.json({ ok: true, action });
}
