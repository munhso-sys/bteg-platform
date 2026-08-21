import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSmartMineSupabaseKey, getSmartMineSupabaseUrl } from "./env";

let cached: SupabaseClient | null = null;

export function hasSmartMineDataConfig() {
  return Boolean(getSmartMineSupabaseUrl() && getSmartMineSupabaseKey().key);
}

/** Server-only client for canonical SmartMine views. Never import in client components. */
export function createSmartMineDataClient() {
  if (cached) return cached;
  const url = getSmartMineSupabaseUrl();
  const { key, role } = getSmartMineSupabaseKey();
  if (!url || !key) {
    throw new Error(
      "SmartMine өгөгдлийн холболт тохируулаагүй. SMARTMINE_SUPABASE_URL болон SMARTMINE_SUPABASE_SERVICE_ROLE_KEY нэмнэ үү.",
    );
  }
  cached = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        "X-Client-Info": `inspect-mn-smartmine/${role}`,
      },
    },
  });
  return cached;
}
