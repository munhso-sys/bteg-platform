export const TELEGRAM_BOT_CONFIG_KEY = "telegram_bot_config";

export const TELEGRAM_CAPABILITIES = [
  "voice.submit",
  "voice.anonymous",
  "ai.ask",
  "reports.overview",
] as const;

export type TelegramCapability = (typeof TELEGRAM_CAPABILITIES)[number];

export type TelegramElevatedUser = {
  telegramId: string;
  username: string;
  fullName: string;
  capabilities: TelegramCapability[];
  note: string;
  updatedAt: string;
};

export type TelegramBotConfig = {
  defaults: TelegramCapability[];
  elevated: TelegramElevatedUser[];
  updatedAt: string;
};

export const CAPABILITY_LABELS: Record<TelegramCapability, string> = {
  "voice.submit": "Санал / хүсэлт / гомдол / асуулга илгээх",
  "voice.anonymous": "Нэргүй илгээх",
  "ai.ask": "AI туслахтай холбогдох",
  "reports.overview": "Тайлан мэдээ авах",
};

export const CAPABILITY_HINTS: Record<TelegramCapability, string> = {
  "voice.submit": "/санал, /хүсэлт, /гомдол, /асуулга",
  "voice.anonymous": "/anonymous …",
  "ai.ask": "/ai … · /асуу …",
  "reports.overview": "/тайлан · /report",
};

export const DEFAULT_TELEGRAM_BOT_CONFIG: TelegramBotConfig = {
  defaults: ["voice.submit", "voice.anonymous"],
  elevated: [],
  updatedAt: new Date(0).toISOString(),
};

function isCapability(value: unknown): value is TelegramCapability {
  return (
    typeof value === "string" &&
    (TELEGRAM_CAPABILITIES as readonly string[]).includes(value)
  );
}

export function normalizeCapabilities(raw: unknown): TelegramCapability[] {
  if (!Array.isArray(raw)) return [];
  const out: TelegramCapability[] = [];
  for (const item of raw) {
    if (isCapability(item) && !out.includes(item)) out.push(item);
  }
  return out;
}

export function normalizeElevatedUser(raw: unknown): TelegramElevatedUser | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const telegramId = String(obj.telegramId ?? "").trim();
  if (!telegramId) return null;
  return {
    telegramId,
    username: String(obj.username ?? "").trim(),
    fullName: String(obj.fullName ?? "").trim(),
    capabilities: normalizeCapabilities(obj.capabilities),
    note: String(obj.note ?? "").trim(),
    updatedAt:
      typeof obj.updatedAt === "string" && obj.updatedAt
        ? obj.updatedAt
        : new Date().toISOString(),
  };
}

export function normalizeTelegramBotConfig(raw: unknown): TelegramBotConfig {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const defaults = normalizeCapabilities(obj.defaults);
  const elevatedRaw = Array.isArray(obj.elevated) ? obj.elevated : [];
  const elevated: TelegramElevatedUser[] = [];
  const seen = new Set<string>();
  for (const row of elevatedRaw) {
    const user = normalizeElevatedUser(row);
    if (!user || seen.has(user.telegramId)) continue;
    seen.add(user.telegramId);
    elevated.push(user);
  }
  return {
    defaults:
      defaults.length > 0
        ? defaults
        : [...DEFAULT_TELEGRAM_BOT_CONFIG.defaults],
    elevated,
    updatedAt:
      typeof obj.updatedAt === "string" && obj.updatedAt
        ? obj.updatedAt
        : new Date().toISOString(),
  };
}

export function resolveTelegramCapabilities(
  config: TelegramBotConfig,
  telegramId: string,
): Set<TelegramCapability> {
  const caps = new Set<TelegramCapability>(config.defaults);
  const elevated = config.elevated.find((u) => u.telegramId === telegramId);
  if (elevated) {
    for (const c of elevated.capabilities) caps.add(c);
  }
  return caps;
}

export function hasTelegramCapability(
  config: TelegramBotConfig,
  telegramId: string,
  capability: TelegramCapability,
): boolean {
  return resolveTelegramCapabilities(config, telegramId).has(capability);
}

export function buildTelegramHelp(caps: Set<TelegramCapability>): string {
  const lines = ["<b>INSPECT-MN · Telegram туслах</b>", ""];

  if (caps.has("voice.submit")) {
    lines.push("<b>Дуу хоолой</b>");
    lines.push("/санал [текст]");
    lines.push("/хүсэлт [текст]");
    lines.push("/гомдол [текст]");
    lines.push("/асуулга [текст]");
    lines.push("/voice санал|хүсэлт|гомдол|асуулга [текст]");
    if (caps.has("voice.anonymous")) {
      lines.push("/anonymous [текст] — нэргүй илгээх");
    }
    lines.push("");
  }

  if (caps.has("ai.ask")) {
    lines.push("<b>AI туслах</b>");
    lines.push("/ai [асуулт]");
    lines.push("/асуу [асуулт]");
    lines.push("");
  }

  if (caps.has("reports.overview")) {
    lines.push("<b>Тайлан</b>");
    lines.push("/тайлан — товч KPI / дүгнэлт");
    lines.push("/report");
    lines.push("");
  }

  lines.push("/эрх — өөрийн эрх / ID шалгах");
  lines.push("");

  if (lines.length <= 3) {
    lines.push("Танд одоогоор ботын эрх олгогдоогүй байна.");
    lines.push("Удирдлагын төв → Telegram бот тохиргооноос эрх авна уу.");
  } else {
    lines.push("Тусламж: /help");
  }

  return lines.join("\n");
}
