import { gunzipSync, gzipSync } from "zlib";
import {
  createServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export const REMOTE_KEYS = {
  db: "policy_compliance_db",
  positionOrgOverrides: "policy_compliance_position_org_overrides",
  policyOrgOverrides: "policy_compliance_policy_org_overrides",
  orgCatalogOverrides: "policy_compliance_org_catalog_overrides",
  /** Full policy↔org classification (title-match + overrides). Used by Portal Policy Review. */
  referenceMap: "policy_compliance_reference_map",
} as const;

export type RemoteKey = (typeof REMOTE_KEYS)[keyof typeof REMOTE_KEYS];

type GzipEnvelope = {
  __encoding: "gzip-base64";
  data: string;
};

export type RemoteRow = {
  payload: unknown;
  updatedAt: string | null;
};

function isGzipEnvelope(value: unknown): value is GzipEnvelope {
  return (
    !!value &&
    typeof value === "object" &&
    (value as GzipEnvelope).__encoding === "gzip-base64" &&
    typeof (value as GzipEnvelope).data === "string"
  );
}

/** Compact large JSON for app_data_store (db.json ~7MB pretty → much smaller gzip). */
export function encodeRemotePayload(payload: unknown): unknown {
  const json = JSON.stringify(payload);
  if (json.length < 500_000) return payload;
  const compressed = gzipSync(Buffer.from(json, "utf8")).toString("base64");
  return { __encoding: "gzip-base64", data: compressed } satisfies GzipEnvelope;
}

export function decodeRemotePayload<T>(payload: unknown): T | null {
  if (payload == null) return null;
  if (isGzipEnvelope(payload)) {
    try {
      const json = gunzipSync(Buffer.from(payload.data, "base64")).toString(
        "utf8",
      );
      return JSON.parse(json) as T;
    } catch (err) {
      console.warn("[remote-store] gzip decode failed:", err);
      return null;
    }
  }
  return payload as T;
}

/**
 * P0-03: org-partitioned document load.
 * organizationId maps to user_profiles.heltes_id / unit heltes scope.
 */
export async function loadOrgRemoteRow(
  organizationId: string,
  key: RemoteKey,
): Promise<RemoteRow | null> {
  const org = organizationId.trim();
  if (!org || !isSupabaseConfigured()) return null;
  const client = createServerSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from("org_app_data_store")
    .select("payload, updated_at")
    .eq("organization_id", org)
    .eq("key", key)
    .maybeSingle();

  if (error) {
    console.warn(
      `[remote-store] org load failed (${org}/${key}):`,
      error.message,
    );
    return null;
  }
  if (!data?.payload) return null;
  return {
    payload: data.payload,
    updatedAt: data.updated_at ? String(data.updated_at) : null,
  };
}

export async function loadOrgRemotePayload<T>(
  organizationId: string,
  key: RemoteKey,
): Promise<T | null> {
  const row = await loadOrgRemoteRow(organizationId, key);
  if (!row) return null;
  return decodeRemotePayload<T>(row.payload);
}

export async function saveOrgRemotePayload(
  organizationId: string,
  key: RemoteKey,
  payload: unknown,
): Promise<boolean> {
  const org = organizationId.trim();
  if (!org) {
    console.warn("[remote-store] refused save without organizationId (P0-03)");
    return false;
  }
  if (!isSupabaseConfigured()) return false;
  const client = createServerSupabaseClient();
  if (!client) return false;

  const updatedAt = new Date().toISOString();
  const { error } = await client.from("org_app_data_store").upsert(
    {
      organization_id: org,
      key,
      payload: encodeRemotePayload(payload),
      updated_at: updatedAt,
    },
    { onConflict: "organization_id,key" },
  );

  if (error) {
    console.warn(
      `[remote-store] org save failed (${org}/${key}):`,
      error.message,
    );
    return false;
  }
  return true;
}

/** @deprecated P0-03 — global mega-row; prefer org-scoped APIs. */
export async function loadRemoteRow(key: RemoteKey): Promise<RemoteRow | null> {
  if (!isSupabaseConfigured()) return null;
  const client = createServerSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from("app_data_store")
    .select("payload, updated_at")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    console.warn(`[remote-store] load failed (${key}):`, error.message);
    return null;
  }
  if (!data?.payload) return null;
  return {
    payload: data.payload,
    updatedAt: data.updated_at ? String(data.updated_at) : null,
  };
}

export async function loadRemotePayload<T>(
  key: RemoteKey,
  organizationId?: string | null,
): Promise<T | null> {
  const org = organizationId?.trim();
  if (org) {
    return loadOrgRemotePayload<T>(org, key);
  }
  const row = await loadRemoteRow(key);
  if (!row) return null;
  return decodeRemotePayload<T>(row.payload);
}

export async function saveRemotePayload(
  key: RemoteKey,
  payload: unknown,
  organizationId?: string | null,
): Promise<boolean> {
  const org = organizationId?.trim();
  if (org) {
    const ok = await saveOrgRemotePayload(org, key, payload);
    if (ok) return true;
    // org_app_data_store may be missing on Production — fall through to global.
    console.warn(
      `[remote-store] org save failed for ${org}/${key}; falling back to global app_data_store`,
    );
  }
  if (!isSupabaseConfigured()) return false;
  const client = createServerSupabaseClient();
  if (!client) return false;

  const updatedAt = new Date().toISOString();
  const { error } = await client.from("app_data_store").upsert(
    {
      key,
      payload: encodeRemotePayload(payload),
      updated_at: updatedAt,
    },
    { onConflict: "key" },
  );

  if (error) {
    console.warn(`[remote-store] save failed (${key}):`, error.message);
    return false;
  }
  return true;
}

/**
 * Conditional save for optimistic concurrency.
 * - expectedUpdatedAt null → insert only if missing
 * - otherwise update only when updated_at still matches
 * When organizationId is set, uses org_app_data_store (P0-03).
 */
export async function saveRemotePayloadIfMatch(
  key: RemoteKey,
  payload: unknown,
  expectedUpdatedAt: string | null,
  organizationId?: string | null,
): Promise<"ok" | "conflict" | "error"> {
  if (!isSupabaseConfigured()) return "error";
  const client = createServerSupabaseClient();
  if (!client) return "error";

  const nextUpdatedAt = new Date().toISOString();
  const encoded = encodeRemotePayload(payload);
  const org = organizationId?.trim();

  if (org) {
    if (expectedUpdatedAt == null) {
      const { error } = await client.from("org_app_data_store").insert({
        organization_id: org,
        key,
        payload: encoded,
        updated_at: nextUpdatedAt,
      });
      if (error) {
        if (error.code === "23505") return "conflict";
        console.warn(
          `[remote-store] org insert failed (${org}/${key}):`,
          error.message,
        );
        return "error";
      }
      return "ok";
    }
    const { data, error } = await client
      .from("org_app_data_store")
      .update({
        payload: encoded,
        updated_at: nextUpdatedAt,
      })
      .eq("organization_id", org)
      .eq("key", key)
      .eq("updated_at", expectedUpdatedAt)
      .select("key");
    if (error) {
      console.warn(
        `[remote-store] org conditional update failed (${org}/${key}):`,
        error.message,
      );
      return "error";
    }
    if (!data?.length) return "conflict";
    return "ok";
  }

  if (expectedUpdatedAt == null) {
    const { error } = await client.from("app_data_store").insert({
      key,
      payload: encoded,
      updated_at: nextUpdatedAt,
    });
    if (error) {
      if (error.code === "23505") return "conflict";
      console.warn(`[remote-store] insert failed (${key}):`, error.message);
      return "error";
    }
    return "ok";
  }

  const { data, error } = await client
    .from("app_data_store")
    .update({
      payload: encoded,
      updated_at: nextUpdatedAt,
    })
    .eq("key", key)
    .eq("updated_at", expectedUpdatedAt)
    .select("key");

  if (error) {
    console.warn(`[remote-store] conditional update failed (${key}):`, error.message);
    return "error";
  }
  if (!data?.length) return "conflict";
  return "ok";
}

/** Prefer remote on serverless; local filesystem remains source of truth in dev. */
export function preferRemoteStore() {
  return Boolean(process.env.VERCEL) || process.env.USE_REMOTE_STORE === "1";
}
