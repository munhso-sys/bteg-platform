import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import type { RoleId, UserProfile } from "@/lib/rbac/types";
import { loadRoleModuleMenuConfig } from "@/lib/rbac/role-menu-visibility";
import { signModuleNavGrant } from "@/lib/rbac/nav-grant";

/** Must match development module `RD_UID_QUERY` (`rd_uid`). */
export const DEVELOPMENT_RD_UID_QUERY = "rd_uid";

/**
 * Pass portal-authenticated user id + signed nav grant into the R&D iframe.
 */
export async function buildDevelopmentEmbedOptions(): Promise<{
  entryPath: string;
  query: Record<string, string>;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return null;

  const db = hasServiceRole() ? createAdminClient() : supabase;
  const { data: profile } = await db
    .from("user_profiles")
    .select("role_id, status")
    .eq("user_id", user.id)
    .maybeSingle();
  const p = profile as Pick<UserProfile, "role_id" | "status"> | null;
  const roleId = (p?.role_id ?? null) as RoleId | null;

  let nav: string | undefined;
  let entryPath = "/dashboard";
  if (p?.status === "active" && roleId) {
    const cfg = await loadRoleModuleMenuConfig(db, roleId, "development");
    const token = signModuleNavGrant("development", cfg);
    if (token) nav = token;
    if (cfg?.menuIds?.length) entryPath = cfg.menuIds[0]!;
  }

  return {
    entryPath,
    query: {
      [DEVELOPMENT_RD_UID_QUERY]: user.id,
      ...(nav ? { nav } : {}),
    },
  };
}
