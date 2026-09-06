import { createServerClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
}

export function getSupabaseAnonKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    ""
  );
}

export async function createUserServerClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) return null;

  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // ignore when called from a Server Component
        }
      },
    },
  });
}

/** Service role — only for test seeding / never for browser. */
export function createServiceRoleClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";
  if (!url || !key) return null;
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
