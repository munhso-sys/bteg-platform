import { NextResponse } from "next/server";
import { requireAdminContext } from "@/lib/rbac/require-admin";
import {
  normalizeTelegramBotConfig,
  type TelegramBotConfig,
} from "@/lib/telegram/bot-config";
import {
  readTelegramBotConfig,
  writeTelegramBotConfig,
} from "@/lib/telegram/bot-config-store";
import { readVoiceDb } from "@/lib/voice/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireAdminContext();
  if ("error" in ctx) return ctx.error;

  const [config, voice] = await Promise.all([
    readTelegramBotConfig(),
    readVoiceDb(),
  ]);

  return NextResponse.json({
    ok: true,
    config,
    knownUsers: voice.telegramUsers
      .slice()
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt)),
  });
}

type PatchBody = {
  config?: Partial<TelegramBotConfig>;
};

export async function PATCH(req: Request) {
  const ctx = await requireAdminContext();
  if ("error" in ctx) return ctx.error;

  const body = (await req.json()) as PatchBody;
  if (!body.config || typeof body.config !== "object") {
    return NextResponse.json(
      { ok: false, error: "config шаардлагатай" },
      { status: 400 },
    );
  }

  try {
    const current = await readTelegramBotConfig();
    const merged = normalizeTelegramBotConfig({
      ...current,
      ...body.config,
      defaults: body.config.defaults ?? current.defaults,
      elevated: body.config.elevated ?? current.elevated,
    });
    const config = await writeTelegramBotConfig(merged);
    return NextResponse.json({ ok: true, config });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Хадгалахад алдаа",
      },
      { status: 500 },
    );
  }
}
