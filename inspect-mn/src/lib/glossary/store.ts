import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import defaultMeta from "@/data/glossary-meta.json";
import type { GlossaryDb, GlossaryMeta } from "@/lib/glossary/types";

export const GLOSSARY_DB_KEY = "platform_glossary_db";

type Cache = { db?: GlossaryDb; loadedAt?: number };
const TTL_MS = 8_000;

function cache(): Cache {
  const root = globalThis as typeof globalThis & { __glossaryDb?: Cache };
  if (!root.__glossaryDb) root.__glossaryDb = {};
  return root.__glossaryDb;
}

export function emptyGlossaryDb(): GlossaryDb {
  return {
    overrides: {},
    customTerms: [],
    meta: structuredClone(defaultMeta) as GlossaryMeta,
  };
}

export async function readGlossaryDb(): Promise<GlossaryDb> {
  const current = cache();
  if (current.db && current.loadedAt && Date.now() - current.loadedAt < TTL_MS) {
    return current.db;
  }

  if (!hasServiceRole()) {
    const db = current.db ?? emptyGlossaryDb();
    current.db = db;
    current.loadedAt = Date.now();
    return db;
  }

  const { data, error } = await createAdminClient()
    .from("app_data_store")
    .select("payload")
    .eq("key", GLOSSARY_DB_KEY)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const payload = data?.payload as Partial<GlossaryDb> | null;
  const db: GlossaryDb = {
    overrides:
      payload?.overrides && typeof payload.overrides === "object"
        ? payload.overrides
        : {},
    customTerms: Array.isArray(payload?.customTerms) ? payload.customTerms : [],
    meta: payload?.meta
      ? { ...emptyGlossaryDb().meta, ...payload.meta }
      : emptyGlossaryDb().meta,
    updatedAt: payload?.updatedAt,
  };
  current.db = db;
  current.loadedAt = Date.now();
  return db;
}

export async function writeGlossaryDb(db: GlossaryDb) {
  const next: GlossaryDb = {
    ...db,
    updatedAt: new Date().toISOString(),
  };

  if (!hasServiceRole()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY тохируулаагүй байна");
    }
    const current = cache();
    current.db = next;
    current.loadedAt = Date.now();
    return;
  }

  const { error } = await createAdminClient().from("app_data_store").upsert(
    {
      key: GLOSSARY_DB_KEY,
      payload: next,
      updated_at: next.updatedAt,
    },
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);

  const current = cache();
  current.db = next;
  current.loadedAt = Date.now();
}

export async function updateGlossaryDb(mutator: (db: GlossaryDb) => void) {
  const db = structuredClone(await readGlossaryDb());
  mutator(db);
  await writeGlossaryDb(db);
  return db;
}
