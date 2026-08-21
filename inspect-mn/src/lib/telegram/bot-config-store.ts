import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import {
  DEFAULT_TELEGRAM_BOT_CONFIG,
  TELEGRAM_BOT_CONFIG_KEY,
  normalizeTelegramBotConfig,
  type TelegramBotConfig,
} from "@/lib/telegram/bot-config";

type Memory = { config?: TelegramBotConfig; loadedAt?: number };
const TTL_MS = 10_000;

function mem(): Memory {
  const g = globalThis as typeof globalThis & {
    __telegramBotConfig?: Memory;
  };
  if (!g.__telegramBotConfig) g.__telegramBotConfig = {};
  return g.__telegramBotConfig;
}

export async function readTelegramBotConfig(options?: {
  fresh?: boolean;
}): Promise<TelegramBotConfig> {
  const m = mem();
  if (
    !options?.fresh &&
    m.config &&
    m.loadedAt &&
    Date.now() - m.loadedAt < TTL_MS
  ) {
    return m.config;
  }
  if (!hasServiceRole()) {
    m.config = {
      ...DEFAULT_TELEGRAM_BOT_CONFIG,
      updatedAt: new Date().toISOString(),
    };
    m.loadedAt = Date.now();
    return m.config;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("app_data_store")
    .select("payload")
    .eq("key", TELEGRAM_BOT_CONFIG_KEY)
    .maybeSingle();

  if (error) {
    console.warn("[telegram-bot-config] load failed", error.message);
  }

  const config = data?.payload
    ? normalizeTelegramBotConfig(data.payload)
    : {
        ...DEFAULT_TELEGRAM_BOT_CONFIG,
        updatedAt: new Date().toISOString(),
      };

  m.config = config;
  m.loadedAt = Date.now();
  return config;
}

export async function writeTelegramBotConfig(
  raw: unknown,
): Promise<TelegramBotConfig> {
  const config = normalizeTelegramBotConfig({
    ...(raw && typeof raw === "object" ? raw : {}),
    updatedAt: new Date().toISOString(),
  });

  if (!hasServiceRole()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY тохируулаагүй байна");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("app_data_store").upsert(
    {
      key: TELEGRAM_BOT_CONFIG_KEY,
      payload: config,
      updated_at: config.updatedAt,
    },
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);

  const m = mem();
  m.config = config;
  m.loadedAt = Date.now();
  return config;
}
