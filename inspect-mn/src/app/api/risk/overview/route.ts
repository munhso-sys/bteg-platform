import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { canViewModule } from "@/lib/rbac/permissions";
import type { PermissionId, RoleId, UserProfile } from "@/lib/rbac/types";
import { resolveUnitScope } from "@/lib/rbac/unit-scope";
import { buildRiskOverview } from "@/lib/risk/overview";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Нэвтрээгүй" }, { status: 401 });
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
  }

  if (!canViewModule("risk-management", perms, roleId)) {
    return NextResponse.json(
      { ok: false, error: "Эрсдэлийн модульд хандах эрхгүй" },
      { status: 403 },
    );
  }

  const unitScope = resolveUnitScope(p, roleId);
  const overview = await buildRiskOverview(unitScope);
  return NextResponse.json({
    ok: true,
    ...overview,
    unitScope: unitScope.active
      ? {
          heltesName: unitScope.heltesName,
          albaName: unitScope.albaName,
        }
      : null,
  });
}
