import { NextResponse } from "next/server";
import { requireVoiceAccess } from "@/lib/voice/access";
import { newId, readVoiceDb, updateVoiceDb } from "@/lib/voice/store";
import { shouldNotifyResearch, shouldNotifyRisk } from "@/lib/voice/classify";
import { noticeMessage } from "@/lib/voice/overview";
import type { NoticeTarget, VoiceNotice } from "@/lib/voice/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireVoiceAccess();
  if (access.error) return access.error;
  const db = await readVoiceDb();
  return NextResponse.json({ ok: true, notices: db.notices, items: db.items });
}

export async function POST(req: Request) {
  const access = await requireVoiceAccess();
  if (access.error) return access.error;
  const body = (await req.json()) as {
    voiceId?: string;
    target?: NoticeTarget;
    auto?: boolean;
  };

  const now = new Date().toISOString();
  const created: VoiceNotice[] = [];

  await updateVoiceDb((db) => {
    const items = body.voiceId
      ? db.items.filter((i) => i.id === body.voiceId)
      : db.items;

    for (const item of items) {
      const targets: NoticeTarget[] = body.target
        ? [body.target]
        : [
            ...(shouldNotifyRisk(item) ? (["risk"] as const) : []),
            ...(shouldNotifyResearch(item) ? (["development"] as const) : []),
          ];
      for (const target of targets) {
        const exists = db.notices.some(
          (n) => n.voiceId === item.id && n.target === target && n.status !== "acknowledged",
        );
        if (exists) continue;
        const notice: VoiceNotice = {
          id: newId(),
          voiceId: item.id,
          target,
          status: "sent",
          message: noticeMessage(item, target),
          createdAt: now,
          sentAt: now,
        };
        db.notices.unshift(notice);
        created.push(notice);
        db.items = db.items.map((row) =>
          row.id === item.id
            ? {
                ...row,
                notifyRisk: row.notifyRisk || target === "risk",
                notifyResearch: row.notifyResearch || target === "development",
                updatedAt: now,
              }
            : row,
        );
      }
    }
  });

  return NextResponse.json({ ok: true, created });
}
