import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { emptyOtherWorkDb, type OtherWorkDb } from "@/lib/guidance/other-types";

const KEY = "platform_other_work_db";
const TTL_MS = 10_000;
type Cache = { db?: OtherWorkDb; loadedAt?: number };

function cache(): Cache {
  const root = globalThis as typeof globalThis & { __otherWorkDb?: Cache };
  if (!root.__otherWorkDb) root.__otherWorkDb = {};
  return root.__otherWorkDb;
}

export async function readOtherWorkDb(): Promise<OtherWorkDb> {
  const current = cache();
  if (current.db && current.loadedAt && Date.now() - current.loadedAt < TTL_MS) return current.db;
  if (!hasServiceRole()) {
    const db = current.db ?? emptyOtherWorkDb();
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
  const payload = data?.payload as Partial<OtherWorkDb> | null;
  const db = { items: Array.isArray(payload?.items) ? payload.items : [] };
  current.db = db;
  current.loadedAt = Date.now();
  return db;
}

export async function writeOtherWorkDb(db: OtherWorkDb) {
  const current = cache();
  current.db = db;
  current.loadedAt = Date.now();
  if (!hasServiceRole()) {
    if (process.env.NODE_ENV === "production") throw new Error("SUPABASE_SERVICE_ROLE_KEY тохируулаагүй байна");
    return;
  }
  const { error } = await createAdminClient().from("app_data_store").upsert(
    { key: KEY, payload: db, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);
}

export async function updateOtherWorkDb(mutator: (db: OtherWorkDb) => void) {
  const db = structuredClone(await readOtherWorkDb());
  mutator(db);
  await writeOtherWorkDb(db);
  return db;
}
