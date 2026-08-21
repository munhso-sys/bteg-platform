import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import {
  AI_SCOPE_CONFIG_KEY,
  DEFAULT_AI_SCOPE_CONFIG,
  normalizeAiScopeConfig,
  type AiScopeConfig,
} from "@/lib/ai/scope-config";

type Memory = { config?: AiScopeConfig; loadedAt?: number };
const TTL_MS = 10_000;

function mem(): Memory {
  const g = globalThis as typeof globalThis & {
    __platformAiScopeConfig?: Memory;
  };
  if (!g.__platformAiScopeConfig) g.__platformAiScopeConfig = {};
  return g.__platformAiScopeConfig;
}

export async function readAiScopeConfig(options?: {
  fresh?: boolean;
}): Promise<AiScopeConfig> {
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
    const config = {
      ...DEFAULT_AI_SCOPE_CONFIG,
      updatedAt: new Date().toISOString(),
    };
    m.config = config;
    m.loadedAt = Date.now();
    return config;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("app_data_store")
    .select("payload")
    .eq("key", AI_SCOPE_CONFIG_KEY)
    .maybeSingle();

  if (error) {
    console.warn("[ai-scope-config] load failed", error.message);
  }

  const config = data?.payload
    ? normalizeAiScopeConfig(data.payload)
    : {
        ...DEFAULT_AI_SCOPE_CONFIG,
        updatedAt: new Date().toISOString(),
      };

  m.config = config;
  m.loadedAt = Date.now();
  return config;
}

export async function writeAiScopeConfig(raw: unknown): Promise<AiScopeConfig> {
  const config = normalizeAiScopeConfig({
    ...(raw && typeof raw === "object" ? raw : {}),
    updatedAt: new Date().toISOString(),
  });

  if (!hasServiceRole()) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY тохируулаагүй байна");
  }

  const admin = createAdminClient();
  const { error } = await admin.from("app_data_store").upsert(
    {
      key: AI_SCOPE_CONFIG_KEY,
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
