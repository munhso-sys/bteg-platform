import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/** Inspect-BTEG project — used when Vercel env vars are not set yet. */
const FALLBACK_SUPABASE_URL = "https://umswlpkjiwjohkolsyct.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtc3dscGtqaXdqb2hrb2xzeWN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1NjY5MDQsImV4cCI6MjEwMjE0MjkwNH0.4wN_3W7P7xRVcsGqi7eccxuJiExyvOKM0WuysovFN-c";

export function isSupabaseConfigured() {
  return Boolean(getSupabaseUrl() && getSupabaseKey());
}

function getSupabaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || FALLBACK_SUPABASE_URL
  );
}

function getSupabaseKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    FALLBACK_SUPABASE_ANON_KEY
  );
}

export function createServerSupabaseClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseKey();
  if (!url || !key) return null;
  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
