import { gunzipSync } from "zlib";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";

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

export function decodeStorePayload<T>(payload: unknown): T | null {
  if (payload == null) return null;
  if (isGzipEnvelope(payload)) {
    try {
      const json = gunzipSync(Buffer.from(payload.data, "base64")).toString(
        "utf8",
      );
      return JSON.parse(json) as T;
    } catch (err) {
      console.warn("[risk-store] gzip decode failed", err);
      return null;
    }
  }
  return payload as T;
}

export async function loadAppDataPayload<T>(key: string): Promise<T | null> {
  if (!hasServiceRole()) return null;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("app_data_store")
      .select("payload")
      .eq("key", key)
      .maybeSingle();
    if (error) {
      console.warn(`[risk-store] load ${key}:`, error.message);
      return null;
    }
    return decodeStorePayload<T>(data?.payload);
  } catch (err) {
    console.warn(
      `[risk-store] load ${key} failed`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
