import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import type { RoleId, UserProfile } from "@/lib/rbac/types";
import { loadRoleModuleMenuConfig } from "@/lib/rbac/role-menu-visibility";
import {
  isPathAllowedByMenuSelection,
  resolveGuidanceMenuPath,
  resolvePortalTopMenuPath,
  resolveReportMenuPath,
  resolveRiskMenuPath,
  resolveSettingsMenuPath,
  resolveVoiceMenuPath,
  type ResolvedMenuPath,
} from "@/lib/rbac/menu-route-guard";

type ModuleKey =
  | "portal"
  | "risk-management"
  | "employee-voice"
  | "guidance"
  | "report-analysis"
  | "settings";

function resolverFor(
  moduleKey: ModuleKey,
): (pathname: string) => ResolvedMenuPath | null {
  switch (moduleKey) {
    case "portal":
      return resolvePortalTopMenuPath;
    case "risk-management":
      return resolveRiskMenuPath;
    case "employee-voice":
      return resolveVoiceMenuPath;
    case "guidance":
      return resolveGuidanceMenuPath;
    case "report-analysis":
      return resolveReportMenuPath;
    case "settings":
      return resolveSettingsMenuPath;
  }
}

async function currentPathname(fallback = "/"): Promise<string> {
  const h = await headers();
  return h.get("x-pathname") || fallback;
}

/**
 * Fail-closed redirect when the active role's menu allowlist forbids this path.
 *
 * Admin bypass (transitional, OD-10): `role_id === "admin"` OR the
 * `portal.admin` permission skips ONLY the menu-visibility allowlist below, so
 * the Role эрх UI stays reachable. It does NOT skip any other check:
 *   - an authenticated Supabase user and an active `user_profiles` row are
 *     still required (unauthenticated / inactive → login redirect first);
 *   - page / API permission gates (requireAdmin, requireSettings, module
 *     permissions, org scope, RLS) still run on their own and are unaffected.
 *
 * NAV_G1_ENFORCE=1: a role with NO menu config for this module is DENIED
 * (instead of the pre-G1 compat allow). Admin bypass above still applies.
 */
export async function assertPortalMenuAccess(
  moduleKey: ModuleKey,
  pathname?: string,
) {
  const path = pathname || (await currentPathname());
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);

  const db = hasServiceRole() ? createAdminClient() : supabase;
  const { data: profile } = await db
    .from("user_profiles")
    .select("role_id, status")
    .eq("user_id", user.id)
    .maybeSingle();
  const p = profile as Pick<UserProfile, "role_id" | "status"> | null;
  const roleId = (p?.role_id ?? null) as RoleId | null;

  if (!p || p.status !== "active") {
    redirect("/login");
  }

  // Admin bypass: menu allowlist only (see doc comment) — auth + active status
  // were already enforced above.
  if (roleId === "admin") return;

  // portal.admin permission bypass (menu allowlist only; transitional OD-10)
  if (roleId) {
    const { data: rp } = await db
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", roleId)
      .eq("permission_id", "portal.admin")
      .maybeSingle();
    if (rp) return;
  }

  // Profile is always reachable for the signed-in user.
  if (moduleKey === "settings" && path.startsWith("/settings/profile")) {
    return;
  }

  const selection = await loadRoleModuleMenuConfig(db, roleId, moduleKey);
  // null selection: pre-G1 → compat allow; NAV_G1_ENFORCE=1 → deny (fail closed).
  const resolve = resolverFor(moduleKey);
  if (
    !isPathAllowedByMenuSelection(path, selection, resolve, {
      moduleId: moduleKey,
      source: "assert-menu-access",
    })
  ) {
    // Fall back to first allowed menu path or home
    const first = selection?.menuIds?.[0];
    if (moduleKey === "portal" && first) {
      const hrefMap: Record<string, string> = {
        inspection: "/inspection",
        "policy-compliance": "/policy-compliance",
        guidance: "/guidance",
        development: "/development",
        process: "/process",
        "employee-voice": "/employee-voice",
        "risk-management": "/risk-management",
        "report-analysis": "/report-analysis",
        smartmine: "/smartmine",
        "ai-assistant": "/ai-assistant",
        "policy-review": "/policy-review",
        glossary: "/glossary",
        settings: "/settings",
        "management-center": "/management-center",
      };
      redirect(hrefMap[first] ?? "/");
    }
    // Parent with an explicit submenu list → land on its first allowed child
    // (redirecting to a denied parent root would loop).
    redirect((first && selection?.submenuIds?.[first]?.[0]) || first || "/");
  }
}
