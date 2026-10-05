import { createClient } from "@/lib/supabase/server";
import type { PermissionId, RoleId, UserProfile } from "@/lib/rbac/types";
import {
  MODULE_VIEW_PERMISSION,
  UNIT_FINDINGS_ROLES,
} from "@/lib/rbac/types";

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  return (data as UserProfile | null) ?? null;
}

export async function getEffectivePermissions(
  userId: string,
  roleId: RoleId | null,
): Promise<Set<PermissionId>> {
  const supabase = await createClient();
  const perms = new Set<PermissionId>();

  if (roleId) {
    const { data: rolePerms } = await supabase
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", roleId);
    for (const row of rolePerms ?? []) {
      perms.add(row.permission_id as PermissionId);
    }

    const { data: smartMinePermission } = await supabase
      .from("permissions")
      .select("id")
      .eq("id", "module.smartmine.view")
      .maybeSingle();
    if (
      !smartMinePermission &&
      perms.has("module.results.view")
    ) {
      perms.add("module.smartmine.view");
    }

    const { data: glossaryPermission } = await supabase
      .from("permissions")
      .select("id")
      .eq("id", "module.glossary.view")
      .maybeSingle();
    if (!glossaryPermission && perms.has("module.tools.view")) {
      perms.add("module.glossary.view");
    }
  }

  const now = new Date().toISOString();
  const { data: grants } = await supabase
    .from("temporary_edit_grants")
    .select("permission_id")
    .eq("user_id", userId)
    .is("revoked_at", null)
    .lte("starts_at", now)
    .gte("ends_at", now);

  for (const g of grants ?? []) {
    perms.add(g.permission_id as PermissionId);
  }

  return perms;
}

export function canViewModule(
  moduleId: string,
  permissions: Set<PermissionId>,
  roleId: RoleId | null,
): boolean {
  if (permissions.has("portal.admin")) return true;

  const required = MODULE_VIEW_PERMISSION[moduleId];
  if (!required) return true;

  if (permissions.has(required)) return true;

  // Unit-scoped inspection view for managers / senior specialists
  if (
    moduleId === "inspection" &&
    roleId &&
    UNIT_FINDINGS_ROLES.includes(roleId) &&
    permissions.has("module.inspection.unit_findings.view")
  ) {
    return true;
  }

  // Settings visible to anyone with portal.settings or admin pages
  if (moduleId === "settings" && permissions.has("portal.admin")) {
    return true;
  }

  return false;
}

export async function currentAccess() {
  const profile = await getCurrentProfile();
  if (!profile || profile.status !== "active" || !profile.role_id) {
    return {
      profile,
      permissions: new Set<PermissionId>(["module.policy.view"]),
      isAdmin: false,
    };
  }
  const permissions = await getEffectivePermissions(
    profile.user_id,
    profile.role_id,
  );
  return {
    profile,
    permissions,
    isAdmin: profile.role_id === "admin" || permissions.has("portal.admin"),
  };
}
