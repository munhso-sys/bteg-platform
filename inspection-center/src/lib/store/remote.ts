import {
  createServerSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabase/server";

export const REMOTE_KEYS = {
  store: "inspection_center_store",
  annualPlans: "inspection_center_annual_plans",
  annualPlanTypes: "inspection_center_annual_plan_types",
  master: "inspection_center_master",
  orgTemplateAllocations: "inspection_center_org_template_allocations",
} as const;

export type RemoteKey = (typeof REMOTE_KEYS)[keyof typeof REMOTE_KEYS];

export type RemoteRow<T> = {
  payload: T;
  updatedAt: string;
};

/**
 * P0-03: Prefer org-partitioned store when organizationId is known.
 * Legacy global app_data_store mega-row is fallback/read-only migration aid only.
 */
export async function loadOrgRemoteRow<T>(
  organizationId: string,
  key: RemoteKey,
): Promise<RemoteRow<T> | null> {
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
    console.warn(`[store:org-remote] load failed (${org}/${key}):`, error.message);
    return null;
  }
  if (!data?.payload) return null;
  return {
    payload: data.payload as T,
    updatedAt: String(data.updated_at ?? ""),
  };
}

export async function saveOrgRemotePayload(
  organizationId: string,
  key: RemoteKey,
  payload: unknown,
) {
  const org = organizationId.trim();
  if (!org) {
    console.warn("[store:org-remote] refused save without organizationId");
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
      payload,
      updated_at: updatedAt,
    },
    { onConflict: "organization_id,key" },
  );

  if (error) {
    console.warn(`[store:org-remote] save failed (${org}/${key}):`, error.message);
    return false;
  }
  return true;
}

/** @deprecated P0-03 — global mega-row; do not write multi-tenant business data here. */
export async function loadRemoteRow<T>(
  key: RemoteKey,
): Promise<RemoteRow<T> | null> {
  if (!isSupabaseConfigured()) return null;
  const client = createServerSupabaseClient();
  if (!client) return null;

  const { data, error } = await client
    .from("app_data_store")
    .select("payload, updated_at")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    console.warn(`[store:remote] load failed (${key}):`, error.message);
    return null;
  }
  if (!data?.payload) return null;
  return {
    payload: data.payload as T,
    updatedAt: String(data.updated_at ?? ""),
  };
}

export async function loadRemotePayload<T>(key: RemoteKey): Promise<T | null> {
  const row = await loadRemoteRow<T>(key);
  return row?.payload ?? null;
}

/**
 * Writes prefer org-scoped table when organizationId provided.
 * Unscoped writes to the legacy mega-key are refused (P0-03).
 */
export async function saveRemotePayload(
  key: RemoteKey,
  payload: unknown,
  organizationId?: string | null,
) {
  const org = organizationId?.trim();
  if (org) {
    return saveOrgRemotePayload(org, key, payload);
  }
  console.warn(
    `[store:remote] refused unscoped mega-key write for ${key} (P0-03)`,
  );
  return false;
}
