import { gunzipSync, gzipSync } from "zlib";
import {
  createServiceRoleClient,
  getSupabaseAnonKey,
  getSupabaseUrl,
} from "@/lib/supabase/server";
import type { ProcessModuleDb } from "@/lib/types";

export const PROCESS_REMOTE_KEY = "process_module_db";

type GzipEnvelope = {
  __encoding: "gzip-base64";
  data: string;
};

function isGzipEnvelope(value: unknown): value is GzipEnvelope {
  return (
    !!value &&
    typeof value === "object" &&
    (value as GzipEnvelope).__encoding === "gzip-base64" &&
    typeof (value as GzipEnvelope).data === "string"
  );
}

export function preferRemoteStore() {
  return (
    Boolean(process.env.VERCEL) ||
    process.env.USE_REMOTE_STORE === "1"
  );
}

export function isSupabaseConfigured() {
  return Boolean(getSupabaseUrl() && (getSupabaseAnonKey() || process.env.SUPABASE_SERVICE_ROLE_KEY));
}

function encodeRemotePayload(payload: unknown): unknown {
  const json = JSON.stringify(payload);
  if (json.length < 500_000) return payload;
  const compressed = gzipSync(Buffer.from(json, "utf8")).toString("base64");
  return { __encoding: "gzip-base64", data: compressed } satisfies GzipEnvelope;
}

function decodeRemotePayload<T>(payload: unknown): T | null {
  if (payload == null) return null;
  if (isGzipEnvelope(payload)) {
    try {
      const json = gunzipSync(Buffer.from(payload.data, "base64")).toString(
        "utf8",
      );
      return JSON.parse(json) as T;
    } catch (err) {
      console.warn("[process:remote] gzip decode failed:", err);
      return null;
    }
  }
  return payload as T;
}

export async function loadRemoteProcessDb(): Promise<ProcessModuleDb | null> {
  if (!preferRemoteStore() || !isSupabaseConfigured()) return null;
  const client = createServiceRoleClient();
  if (!client) {
    console.warn("[process:remote] missing SUPABASE_SERVICE_ROLE_KEY");
    return null;
  }
  const { data, error } = await client
    .from("app_data_store")
    .select("payload")
    .eq("key", PROCESS_REMOTE_KEY)
    .maybeSingle();
  if (error) {
    console.warn("[process:remote] load failed:", error.message);
    return null;
  }
  if (!data?.payload) return null;
  return decodeRemotePayload<ProcessModuleDb>(data.payload);
}

export async function saveRemoteProcessDb(
  db: ProcessModuleDb,
): Promise<boolean> {
  if (!preferRemoteStore() || !isSupabaseConfigured()) return false;
  const client = createServiceRoleClient();
  if (!client) return false;
  const { error } = await client.from("app_data_store").upsert(
    {
      key: PROCESS_REMOTE_KEY,
      payload: encodeRemotePayload(db),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) {
    console.warn("[process:remote] save failed:", error.message);
    return false;
  }
  return true;
}
