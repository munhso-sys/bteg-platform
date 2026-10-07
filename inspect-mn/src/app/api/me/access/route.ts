import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { canViewModule } from "@/lib/rbac/permissions";
import type { PermissionId, RoleId, UserProfile } from "@/lib/rbac/types";
import { MODULES } from "@/lib/modules";

async function loadPermissions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  userId: string,
  roleId: RoleId | null,
): Promise<Set<PermissionId>> {
  const perms = new Set<PermissionId>();

  if (roleId) {
    const { data: rolePerms } = await db
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", roleId);
    for (const row of rolePerms ?? []) {
      perms.add(row.permission_id as PermissionId);
    }
  }

  const now = new Date().toISOString();
  const { data: grants } = await db
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

async function ensureBootstrapAdmin(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: any,
  userId: string,
  email: string | undefined,
): Promise<UserProfile | null> {
  const { count } = await admin
    .from("user_profiles")
    .select("*", { count: "exact", head: true })
    .eq("role_id", "admin")
    .eq("status", "active");

  if ((count ?? 0) > 0) return null;

  const profile: UserProfile = {
    user_id: userId,
    email: email ?? "",
    full_name: email ?? "Admin",
    phone: null,
    heltes_id: null,
    heltes_name: null,
    alba_id: null,
    alba_name: null,
    position_id: null,
    position_name: null,
    role_id: "admin",
    status: "active",
  };

  const { error } = await admin.from("user_profiles").upsert({
    ...profile,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    console.error("bootstrap admin failed", error.message);
    return null;
  }
  return profile;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Нэвтрээгүй" }, { status: 401 });
  }

  // Prefer service role to avoid RLS recursion / silent empty profile reads
  const db = hasServiceRole() ? createAdminClient() : supabase;

  const { data: profile, error: profileError } = await db
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("profile read failed", profileError.message);
  }

  let p = profile as UserProfile | null;

  if ((!p || p.status !== "active" || !p.role_id) && hasServiceRole()) {
    const bootstrapped = await ensureBootstrapAdmin(
      createAdminClient(),
      user.id,
      user.email,
    );
    if (bootstrapped) p = bootstrapped;
  }

  const roleId = (p?.role_id ?? null) as RoleId | null;
  const permissions =
    p && p.status === "active"
      ? await loadPermissions(db, user.id, roleId)
      : new Set<PermissionId>(["module.policy.view"]);

  let roleLabel: string | null = null;
  if (roleId) {
    const { data: roleRow } = await db
      .from("roles")
      .select("label")
      .eq("id", roleId)
      .maybeSingle();
    roleLabel = (roleRow?.label as string | undefined) ?? null;
  }

  let modules = MODULES.filter((m) =>
    canViewModule(m.id, permissions, roleId),
  ).map((m) => m.id);

  // Optional Role эрх portal-menu allowlist (app_data_store).
  try {
    const { loadRoleModuleMenuConfig } = await import(
      "@/lib/rbac/role-menu-visibility"
    );
    const portalMenus = await loadRoleModuleMenuConfig(db, roleId, "portal");
    if (portalMenus && Array.isArray(portalMenus.menuIds)) {
      const allow = new Set(portalMenus.menuIds);
      modules = modules.filter((id) => allow.has(id));
    }
  } catch (err) {
    console.warn("[me/access] portal menu filter skipped", err);
  }

  return NextResponse.json({
    ok: true,
    profile: p
      ? {
          ...p,
          role_label: roleLabel,
        }
      : null,
    role_id: roleId,
    role_label: roleLabel,
    permissions: Array.from(permissions),
    modules,
    isAdmin: roleId === "admin" || permissions.has("portal.admin"),
  });
}
