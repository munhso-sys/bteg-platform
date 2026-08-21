const DEFAULT_URL = "https://hlidcdaaxmdhisdfkaca.supabase.co";

export {
  SMARTMINE_DEFAULT_FROM,
  defaultSmartMineRange,
  todayIso,
} from "./constants";

export function getSmartMineSupabaseUrl() {
  return process.env.SMARTMINE_SUPABASE_URL?.trim() || DEFAULT_URL;
}

export function getSmartMineSupabaseKey() {
  const service = process.env.SMARTMINE_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (service) return { key: service, role: "service" as const };
  const anon = process.env.SMARTMINE_SUPABASE_ANON_KEY?.trim();
  if (anon) return { key: anon, role: "anon" as const };
  return { key: "", role: "missing" as const };
}

export function getSmartMineOrganizationId() {
  const value = process.env.SMARTMINE_ORGANIZATION_ID?.trim();
  return value ? value.toUpperCase() : "BAYANGOL";
}
