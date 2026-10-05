import { createServerClient } from "@supabase/ssr";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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

function bearerFromRequest(request?: Request | null) {
  const raw = request?.headers.get("authorization")?.trim() || "";
  if (!raw.toLowerCase().startsWith("bearer ")) return null;
  const token = raw.slice(7).trim();
  return token || null;
}

/**
 * User-scoped Supabase client.
 * Prefer Authorization Bearer from portal iframe session (third-party cookie safe);
 * fall back to auth cookies when present.
 */
export async function createUserServerClient(request?: Request | null) {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();
  if (!url || !key) return null;

  const bearer = bearerFromRequest(request);
  if (bearer) {
    return createServerClient(url, key, {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // bearer mode — no cookie writes
        },
      },
      global: {
        headers: {
          Authorization: `Bearer ${bearer}`,
        },
      },
    });
  }

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

/** Build a JSON response while applying Supabase auth cookie writes. */
export async function createSessionCookieClient(response: NextResponse) {
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
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // ignore
          }
          response.cookies.set(name, value, options);
        });
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
