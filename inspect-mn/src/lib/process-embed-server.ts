import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import type { RoleId, UserProfile } from "@/lib/rbac/types";
import { loadRoleModuleMenuConfig } from "@/lib/rbac/role-menu-visibility";
import { signModuleNavGrant } from "@/lib/rbac/nav-grant";

/** Pass portal-authenticated user id + signed nav grant into the Process iframe. */
export async function buildProcessEmbedOptions(): Promise<{
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
  let entryPath = "/processes";
  if (p?.status === "active" && roleId) {
    const cfg = await loadRoleModuleMenuConfig(db, roleId, "process");
    const token = signModuleNavGrant("process", cfg);
    if (token) nav = token;
    if (cfg?.menuIds?.length) entryPath = cfg.menuIds[0]!;
  }

  return {
    entryPath,
    query: {
      uid: user.id,
      ...(nav ? { nav } : {}),
    },
  };
}
