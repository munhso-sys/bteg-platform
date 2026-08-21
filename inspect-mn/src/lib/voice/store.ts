import { randomUUID } from "crypto";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { emptyVoiceDb, type VoiceDb } from "@/lib/voice/types";

const KEY = "employee_voice_db";

type Memory = { db?: VoiceDb; loadedAt?: number };
const TTL_MS = 15_000;

function mem(): Memory {
  const g = globalThis as typeof globalThis & { __voiceDb?: Memory };
  if (!g.__voiceDb) g.__voiceDb = {};
  return g.__voiceDb;
}

export async function readVoiceDb(): Promise<VoiceDb> {
  const m = mem();
  if (m.db && m.loadedAt && Date.now() - m.loadedAt < TTL_MS) return m.db;
  if (!hasServiceRole()) {
    m.db = emptyVoiceDb();
    m.loadedAt = Date.now();
    return m.db;
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("app_data_store")
    .select("payload")
    .eq("key", KEY)
    .maybeSingle();
  if (error) {
    console.warn("[voice-store] load failed", error.message);
  }
  const payload = (data?.payload ?? {}) as Partial<VoiceDb>;
  const db: VoiceDb = {
    items: Array.isArray(payload.items) ? payload.items : [],
    actions: Array.isArray(payload.actions) ? payload.actions : [],
    notices: Array.isArray(payload.notices) ? payload.notices : [],
    telegramUsers: Array.isArray(payload.telegramUsers)
      ? payload.telegramUsers
      : [],
  };
  m.db = db;
  m.loadedAt = Date.now();
  return db;
}

export async function writeVoiceDb(db: VoiceDb) {
  const m = mem();
  m.db = db;
  m.loadedAt = Date.now();
  if (!hasServiceRole()) return;
  const admin = createAdminClient();
  const { error } = await admin.from("app_data_store").upsert(
    {
      key: KEY,
      payload: db,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) {
    console.warn("[voice-store] save failed", error.message);
    throw new Error(error.message);
  }
}

export async function updateVoiceDb(mutator: (db: VoiceDb) => void) {
  const db = structuredClone(await readVoiceDb());
  mutator(db);
  await writeVoiceDb(db);
  return db;
}

export function newId() {
  return randomUUID();
}
