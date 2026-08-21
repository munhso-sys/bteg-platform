import { NextResponse } from "next/server";
import { requireVoiceAccess } from "@/lib/voice/access";
import { portalPublicUrl, telegramToken } from "@/lib/telegram/sendMessage";

export const dynamic = "force-dynamic";

export async function POST() {
  const access = await requireVoiceAccess();
  if (access.error) return access.error;
  const token = telegramToken();
  if (!token) {
    return NextResponse.json(
      { ok: false, error: "TELEGRAM_BOT_TOKEN Vercel дээр тохируулаагүй" },
      { status: 400 },
    );
  }
  const webhookUrl = `${portalPublicUrl()}/api/telegram/voice-webhook`;
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ["message"],
    }),
  });
  const telegramResponse = await res.json();
  return NextResponse.json({
    ok: Boolean(telegramResponse.ok),
    webhookUrl,
    telegramResponse,
  });
}
