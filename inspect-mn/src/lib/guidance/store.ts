import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { emptyGuidanceDb, type GuidanceDb } from "@/lib/guidance/types";

const KEY = "platform_guidance_db";
type Cache = { db?: GuidanceDb; loadedAt?: number };
const TTL_MS = 10_000;

function cache(): Cache {
  const root = globalThis as typeof globalThis & { __guidanceDb?: Cache };
  if (!root.__guidanceDb) root.__guidanceDb = {};
  return root.__guidanceDb;
}

export async function readGuidanceDb(): Promise<GuidanceDb> {
  const current = cache();
  if (current.db && current.loadedAt && Date.now() - current.loadedAt < TTL_MS) return current.db;
  if (!hasServiceRole()) {
    const db = current.db ?? emptyGuidanceDb();
    current.db = db;
    current.loadedAt = Date.now();
    return db;
  }

  const { data, error } = await createAdminClient()
    .from("app_data_store")
    .select("payload")
    .eq("key", KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const payload = data?.payload as Partial<GuidanceDb> | null;
  const db = { items: Array.isArray(payload?.items) ? payload.items : [] };
  current.db = db;
  current.loadedAt = Date.now();
  return db;
}

export async function writeGuidanceDb(db: GuidanceDb) {
  if (!hasServiceRole()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY тохируулаагүй байна");
    }
    const current = cache();
    current.db = db;
    current.loadedAt = Date.now();
    return;
  }
  const now = new Date().toISOString();
  const { error } = await createAdminClient().from("app_data_store").upsert(
    { key: KEY, payload: db, updated_at: now },
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);
  const current = cache();
  current.db = db;
  current.loadedAt = Date.now();
}

export async function updateGuidanceDb(mutator: (db: GuidanceDb) => void) {
  const db = structuredClone(await readGuidanceDb());
  mutator(db);
  await writeGuidanceDb(db);
  return db;
}
