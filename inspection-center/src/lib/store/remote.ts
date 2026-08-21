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

export async function saveRemotePayload(key: RemoteKey, payload: unknown) {
  if (!isSupabaseConfigured()) return false;
  const client = createServerSupabaseClient();
  if (!client) return false;

  const updatedAt = new Date().toISOString();
  const { error } = await client.from("app_data_store").upsert(
    {
      key,
      payload,
      updated_at: updatedAt,
    },
    { onConflict: "key" },
  );

  if (error) {
    console.warn(`[store:remote] save failed (${key}):`, error.message);
    return false;
  }
  return true;
}
