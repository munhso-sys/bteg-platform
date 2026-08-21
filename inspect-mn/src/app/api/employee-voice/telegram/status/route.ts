import { NextResponse } from "next/server";
import { requireVoiceAccess } from "@/lib/voice/access";
import { portalPublicUrl, telegramToken } from "@/lib/telegram/sendMessage";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireVoiceAccess();
  if (access.error) return access.error;

  const token = telegramToken();
  const webhookUrl = `${portalPublicUrl()}/api/telegram/voice-webhook`;
  if (!token) {
    return NextResponse.json({
      ok: true,
      configured: false,
      webhookUrl,
      bot: null,
      webhook: null,
    });
  }

  const [meRes, hookRes] = await Promise.all([
    fetch(`https://api.telegram.org/bot${token}/getMe`, { cache: "no-store" }),
    fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, {
      cache: "no-store",
    }),
  ]);
  const me = await meRes.json();
  const hook = await hookRes.json();

  return NextResponse.json({
    ok: true,
    configured: true,
    webhookUrl,
    bot: me.ok ? me.result : null,
    webhook: hook.ok ? hook.result : null,
    error: me.ok ? null : me.description,
  });
}
