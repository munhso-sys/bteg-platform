import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { canViewModule } from "@/lib/rbac/permissions";
import type { PermissionId, RoleId, UserProfile } from "@/lib/rbac/types";

export async function requireSmartMineAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      error: NextResponse.json({ ok: false, error: "Нэвтрээгүй" }, { status: 401 }),
    };
  }

  const db = hasServiceRole() ? createAdminClient() : supabase;
  const { data: profile } = await db
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const p = profile as UserProfile | null;
  const roleId = (p?.role_id ?? null) as RoleId | null;
  const perms = new Set<PermissionId>();
  if (roleId) {
    const { data: rolePerms } = await db
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", roleId);
    for (const row of rolePerms ?? []) {
      perms.add(row.permission_id as PermissionId);
    }

    const { data: smartMinePermission } = await db
      .from("permissions")
      .select("id")
      .eq("id", "module.smartmine.view")
      .maybeSingle();
    if (!smartMinePermission && perms.has("module.results.view")) {
      perms.add("module.smartmine.view");
    }
  }
  if (!canViewModule("smartmine", perms, roleId)) {
    return {
      error: NextResponse.json(
        { ok: false, error: "SmartMine модульд хандах эрхгүй" },
        { status: 403 },
      ),
    };
  }
  return { user, profile: p, roleId };
}
