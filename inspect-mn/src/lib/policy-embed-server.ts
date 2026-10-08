import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import type { PermissionId, RoleId, UserProfile } from "@/lib/rbac/types";
import {
  isPositionScopedRole,
  isUnitScopedRole,
  signPolicyEmbedToken,
} from "@/lib/policy-embed";
import { resolveUnitScope } from "@/lib/rbac/unit-scope";
import { loadRoleModuleMenuConfig } from "@/lib/rbac/role-menu-visibility";
import {
  POLICY_EMBED_BUILD_TIMEOUT_MS,
  choosePolicyEmbedMode,
  choosePolicyEntryPath,
  emptyTiming,
  logPolicyEmbedTiming,
  withTimeout,
} from "@/lib/policy-embed-build-core";
import { positionFromProfile } from "@/lib/policy-position-resolve";

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

/**
 * Embed params for Журмын биелэлт iframe.
 *
 * Critical path must NOT call the Policy origin. Cross-origin
 * `/api/positions/resolve` (up to 8s) caused production 504
 * FUNCTION_INVOCATION_TIMEOUT on `/policy-compliance` for non-admins.
 * Position ids come from the portal profile; Policy may normalize later.
 *
 * On failure: return null (controlled UI) — never `{ query: {} }` embed-less.
 */
export async function buildPolicyEmbedOptions(): Promise<{
  entryPath: string;
  query: Record<string, string>;
} | null> {
  const tAll = Date.now();
  try {
    const result = await withTimeout(
      buildPolicyEmbedOptionsInner(),
      POLICY_EMBED_BUILD_TIMEOUT_MS,
      "policy embed",
    );
    logPolicyEmbedTiming("ok", emptyTiming(), {
      wallMs: Date.now() - tAll,
      hasEmbed: Boolean(result?.query?.embed),
    });
    return result;
  } catch (error) {
    console.error("[policy-embed] build failed; refusing embed-less iframe", error);
    logPolicyEmbedTiming("fail", emptyTiming(), {
      wallMs: Date.now() - tAll,
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

async function buildPolicyEmbedOptionsInner(): Promise<{
  entryPath: string;
  query: Record<string, string>;
} | null> {
  const timing = emptyTiming();
  const t0 = Date.now();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = hasServiceRole() ? createAdminClient() : supabase;
  const tProfile = Date.now();
  const { data: profile } = await db
    .from("user_profiles")
    .select(
      "user_id, role_id, status, position_id, position_name, heltes_id, heltes_name, alba_id, alba_name",
    )
    .eq("user_id", user.id)
    .maybeSingle();
  timing.profileMs = Date.now() - tProfile;
  const p = profile as UserProfile | null;
  const roleId = (p?.role_id ?? null) as RoleId | null;

  const tPerm = Date.now();
  const tMenu = Date.now();
  const [permissions, menuCfg] = await Promise.all([
    p && p.status === "active"
      ? loadPermissions(db, user.id, roleId)
      : Promise.resolve(new Set<PermissionId>(["module.policy.view"])),
    roleId
      ? loadRoleModuleMenuConfig(db, roleId, "policy-compliance").catch(
          (err) => {
            console.warn("[policy-embed] menu visibility load skipped", err);
            return null;
          },
        )
      : Promise.resolve(null),
  ]);
  timing.permissionsMs = Date.now() - tPerm;
  timing.menuConfigMs = Date.now() - tMenu;
  // Remote resolve intentionally not called (RC1).
  timing.resolveMs = 0;

  const canEdit =
    permissions.has("module.policy.edit") ||
    permissions.has("portal.admin") ||
    roleId === "admin";

  const unit = resolveUnitScope(p, roleId);
  const menus = menuCfg?.menuIds ?? null;
  const submenus = menuCfg?.submenuIds ?? null;
  const hasRoleMenus = Boolean(menus && menus.length > 0);

  const mode = choosePolicyEmbedMode({
    canEdit,
    isUnitScoped: isUnitScopedRole(roleId),
    unitActive: unit.active,
    isPositionScoped: isPositionScopedRole(roleId),
    hasRoleMenus,
  });

  const { id: positionId, name: positionName } = positionFromProfile(p ?? {});

  const tSign = Date.now();
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
  timing.signMs = Date.now() - tSign;
  timing.totalMs = Date.now() - t0;

  logPolicyEmbedTiming("inner", timing, {
    roleId,
    mode,
    hasRoleMenus,
    hasPosition: Boolean(positionId || positionName),
    canEdit,
  });

  if (!token) {
    // Fail closed: never mount Policy iframe without a signed embed.
    return null;
  }

  const softQuery: Record<string, string> = {
    ...(mode !== "full" ? { scope: mode } : {}),
    ...(positionId ? { position_id: positionId } : {}),
    ...(positionName ? { position_name: positionName } : {}),
    ...(unit.heltesId ? { heltes_id: unit.heltesId } : {}),
    ...(unit.albaId ? { alba_id: unit.albaId } : {}),
    ...(unit.heltesName ? { heltes_name: unit.heltesName } : {}),
    ...(unit.albaName ? { alba_name: unit.albaName } : {}),
  };

  const entryPath = choosePolicyEntryPath({
    mode,
    positionId,
    unit: { heltesId: unit.heltesId, albaId: unit.albaId },
    menus,
    submenus,
  });

  return {
    entryPath,
    query: { embed: token, ...softQuery },
  };
}
