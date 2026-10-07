import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import type { PermissionId, RoleId, UserProfile } from "@/lib/rbac/types";
import {
  isUnitScopedRole,
  signPolicyEmbedToken,
  type PolicyEmbedMode,
} from "@/lib/policy-embed";
import { getDutyModuleApps } from "@/lib/module-apps";
import { resolveUnitScope } from "@/lib/rbac/unit-scope";

async function loadPermissions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  userId: string,
  roleId: RoleId | null,
) {
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

async function resolvePositionId(
  rawId: string | null | undefined,
  name: string | null | undefined,
): Promise<{ id: string; name: string } | null> {
  if (!rawId && !name) return null;
  try {
    const origin = getDutyModuleApps()["policy-compliance"].origin;
    const url = new URL(`${origin}/api/positions/resolve`);
    if (rawId) url.searchParams.set("id", rawId);
    if (name) url.searchParams.set("name", name);
    const res = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return rawId ? { id: rawId, name: name || rawId } : null;
    const data = (await res.json()) as {
      ok?: boolean;
      id?: string;
      name?: string;
    };
    if (data?.ok && data.id) {
      return { id: data.id, name: data.name || name || data.id };
    }
  } catch {
    // ignore
  }
  if (rawId) return { id: rawId, name: name || rawId };
  return null;
}

/** Embed params for Журмын биелэлт iframe. */
export async function buildPolicyEmbedOptions(): Promise<{
  entryPath: string;
  query: Record<string, string>;
} | null> {
  try {
    return await buildPolicyEmbedOptionsInner();
  } catch (error) {
    console.error(
      "[policy-embed] build failed; embedding without token",
      error,
    );
    return { entryPath: "/dashboard", query: {} };
  }
}

async function buildPolicyEmbedOptionsInner(): Promise<{
  entryPath: string;
  query: Record<string, string>;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = hasServiceRole() ? createAdminClient() : supabase;
  const { data: profile } = await db
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const p = profile as UserProfile | null;
  const roleId = (p?.role_id ?? null) as RoleId | null;
  const permissions =
    p && p.status === "active"
      ? await loadPermissions(db, user.id, roleId)
      : new Set<PermissionId>(["module.policy.view"]);

  const canEdit =
    permissions.has("module.policy.edit") ||
    permissions.has("portal.admin") ||
    roleId === "admin";

  const unit = resolveUnitScope(p, roleId);
  let mode: PolicyEmbedMode = "position";
  if (canEdit) mode = "full";
  else if (isUnitScopedRole(roleId) && unit.active) mode = "unit";

  const resolved = await resolvePositionId(p?.position_id, p?.position_name);
  const positionId = resolved?.id ?? p?.position_id ?? null;
  const positionName = resolved?.name ?? p?.position_name ?? null;

  let menus: string[] | null = null;
  let submenus: Record<string, string[]> | null = null;
  try {
    const { loadRoleModuleMenuConfig } = await import(
      "@/lib/rbac/role-menu-visibility"
    );
    const cfg = await loadRoleModuleMenuConfig(db, roleId, "policy-compliance");
    if (cfg) {
      menus = cfg.menuIds;
      submenus = cfg.submenuIds;
    }
  } catch (err) {
    console.warn("[policy-embed] menu visibility load skipped", err);
  }

  const token = signPolicyEmbedToken({
    uid: user.id,
    role: roleId,
    positionId,
    positionName,
    heltesId: unit.heltesId,
    albaId: unit.albaId,
    heltesName: unit.heltesName,
    albaName: unit.albaName,
    mode,
    menus,
    submenus,
    exp: Date.now() + 12 * 60 * 60 * 1000,
  });

  const softQuery: Record<string, string> = {
    scope: mode,
    ...(positionId ? { position_id: positionId } : {}),
    ...(positionName ? { position_name: positionName } : {}),
    ...(unit.heltesId ? { heltes_id: unit.heltesId } : {}),
    ...(unit.albaId ? { alba_id: unit.albaId } : {}),
    ...(unit.heltesName ? { heltes_name: unit.heltesName } : {}),
    ...(unit.albaName ? { alba_name: unit.albaName } : {}),
  };

  let entryPath = "/dashboard";
  if (mode === "position") {
    entryPath = "/my";
  } else if (mode === "unit") {
    if (unit.heltesId && unit.albaId) {
      entryPath = `/org/heltes/${unit.heltesId}/alba/${unit.albaId}`;
    } else if (unit.heltesId) {
      entryPath = `/org/heltes/${unit.heltesId}`;
    } else {
      entryPath = "/org";
    }
  }

  if (!token) {
    if (mode === "full") return null;
    return { entryPath, query: softQuery };
  }

  return {
    entryPath,
    query: { embed: token, ...softQuery },
  };
}
