/** Prefer classic anon JWT; new `sb_publishable_…` keys can break auth fetch in @supabase/ssr. */
export function getSupabasePublishableKey() {
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (anon && anon.startsWith("eyJ")) return anon;
  if (publishable && publishable.startsWith("eyJ")) return publishable;
  return anon || publishable || "";
}

export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
}
