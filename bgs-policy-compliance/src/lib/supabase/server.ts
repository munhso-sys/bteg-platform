import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getRemoteStoreSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
}

export function getRemoteStoreServiceRoleKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
}

export function isSupabaseConfigured() {
  return Boolean(getRemoteStoreSupabaseUrl() && getRemoteStoreServiceRoleKey());
}

export function createServerSupabaseClient() {
  const url = getRemoteStoreSupabaseUrl();
  const key = getRemoteStoreServiceRoleKey();
  if (!url || !key) return null;
  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
