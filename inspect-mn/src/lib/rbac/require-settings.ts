import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import type { PermissionId, RoleId, UserProfile } from "@/lib/rbac/types";

export async function userCanManageSettings(
  userId: string,
  roleId: RoleId | null,
): Promise<boolean> {
  if (roleId === "admin") return true;
  const db = hasServiceRole() ? createAdminClient() : await createClient();
  if (!roleId) return false;
  const { data: rolePerms } = await db
    .from("role_permissions")
    .select("permission_id")
    .eq("role_id", roleId);
  const perms = new Set<PermissionId>(
    (rolePerms ?? []).map((r: { permission_id: string }) => r.permission_id as PermissionId),
  );
  return perms.has("portal.settings") || perms.has("portal.admin");
}

/** Admin settings pages only — employees are sent to their profile. */
export async function requireSettingsAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings");

  const db = hasServiceRole() ? createAdminClient() : supabase;
  const { data: profile } = await db
    .from("user_profiles")
    .select("role_id, status")
    .eq("user_id", user.id)
    .maybeSingle();
  const p = profile as Pick<UserProfile, "role_id" | "status"> | null;
  if (!p || p.status !== "active") redirect("/settings/profile");

  const ok = await userCanManageSettings(user.id, p.role_id);
  if (!ok) redirect("/settings/profile");
}
