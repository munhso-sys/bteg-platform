/**
 * Enforce Role эрх module sidebar allowlists at the route level.
 * UI hiding alone is not enough — deep links (org, workplace, etc.) must also fail closed.
 */

export type MenuRouteSelection = {
  /** null = no top-level restriction configured */
  menuIds: string[] | null;
  /** missing parent key = all children allowed for that parent */
  submenuIds: Record<string, string[]> | null;
};

export type ResolvedMenuPath = {
  menuId: string;
  /** Catalog submenu id when the path belongs to a parent with children */
  submenuId?: string;
};

/**
 * Map a Policy Compliance pathname to catalog menu/submenu ids.
 * More specific paths first.
 */
export function resolvePolicyMenuPath(
  pathname: string,
): ResolvedMenuPath | null {
  const p = pathname.split("?")[0] || pathname;

  // Settings
  if (p === "/settings/data" || p.startsWith("/settings/data/")) {
    return { menuId: "/settings", submenuId: "/settings/data" };
  }
  if (
    p === "/settings/org-policies" ||
    p.startsWith("/settings/org-policies/")
  ) {
    return { menuId: "/settings", submenuId: "/settings/org-policies" };
  }
  if (
    p === "/settings/org-structure" ||
    p.startsWith("/settings/org-structure/")
  ) {
    return { menuId: "/settings", submenuId: "/settings/org-structure" };
  }
  if (p === "/settings" || p.startsWith("/settings/")) {
    return { menuId: "/settings", submenuId: "/settings" };
  }

  // Policies — review / preview vs management (Удирдлага)
  if (
    p === "/policies/review" ||
    p.startsWith("/policies/review/") ||
    (p.startsWith("/policies/") && p.includes("/preview"))
  ) {
    return { menuId: "/policies", submenuId: "/policies/review" };
  }
  if (p === "/policies" || p.startsWith("/policies/")) {
    return { menuId: "/policies", submenuId: "/policies" };
  }
  if (p.startsWith("/clauses/")) {
    return { menuId: "/policies", submenuId: "/policies" };
  }

  // Positions
  if (p === "/positions/review" || p.startsWith("/positions/review/")) {
    return { menuId: "/positions", submenuId: "/positions/review" };
  }
  if (p === "/positions" || p.startsWith("/positions/")) {
    return { menuId: "/positions", submenuId: "/positions" };
  }

  // Org tree deep links that open policy/position management surfaces
  if (/\/org\/heltes\/[^/]+\/alba\/[^/]+\/policies(?:\/|$)/.test(p)) {
    return { menuId: "/policies", submenuId: "/policies" };
  }
  if (/\/org\/heltes\/[^/]+\/alba\/[^/]+\/positions(?:\/|$)/.test(p)) {
    return { menuId: "/positions", submenuId: "/positions" };
  }
  if (p === "/org" || p.startsWith("/org/")) {
    return { menuId: "/org" };
  }

  if (p === "/dashboard" || p.startsWith("/dashboard/")) {
    return { menuId: "/dashboard" };
  }
  if (p === "/matrix" || p.startsWith("/matrix/")) {
    return { menuId: "/matrix" };
  }
  if (p === "/evaluations" || p.startsWith("/evaluations/")) {
    return { menuId: "/evaluations" };
  }
  if (p === "/imports" || p.startsWith("/imports/")) {
    return { menuId: "/imports" };
  }
  if (p === "/my" || p.startsWith("/my/")) {
    // Position-scoped home — always allow when mode=position; menu config optional
    return null;
  }

  return null;
}

export function isPathAllowedByMenuSelection(
  pathname: string,
  selection: MenuRouteSelection,
  resolve: (pathname: string) => ResolvedMenuPath | null,
): boolean {
  const hasMenuConfig = Array.isArray(selection.menuIds);
  const hasSubmenuConfig =
    selection.submenuIds != null &&
    typeof selection.submenuIds === "object" &&
    Object.keys(selection.submenuIds).length >= 0 &&
    selection.submenuIds !== null;

  // No role menu config at all → unrestricted (compat)
  if (!hasMenuConfig && selection.submenuIds == null) return true;

  const hit = resolve(pathname);
  if (!hit) {
    // Unknown path while config is active → fail closed
    return !(hasMenuConfig || selection.submenuIds != null);
  }

  if (hasMenuConfig && !(selection.menuIds ?? []).includes(hit.menuId)) {
    return false;
  }

  if (
    hit.submenuId &&
    selection.submenuIds &&
    Object.prototype.hasOwnProperty.call(selection.submenuIds, hit.menuId)
  ) {
    const allowed = selection.submenuIds[hit.menuId] ?? [];
    if (!allowed.includes(hit.submenuId)) return false;
  }

  return true;
}

/** Convenience for server/client UI gating (same rules as middleware). */
export function canAccessPolicyPath(
  pathname: string,
  menus: string[] | null | undefined,
  submenus: Record<string, string[]> | null | undefined,
): boolean {
  return isPathAllowedByMenuSelection(
    pathname,
    {
      menuIds: Array.isArray(menus) ? menus : null,
      submenuIds: submenus ?? null,
    },
    resolvePolicyMenuPath,
  );
}

export function firstAllowedPolicyPath(
  selection: MenuRouteSelection,
): string {
  const menus = selection.menuIds;
  if (!menus || menus.length === 0) return "/dashboard";

  const prefer = [
    "/dashboard",
    "/org",
    "/policies/review",
    "/policies",
    "/positions/review",
    "/positions",
    "/matrix",
    "/evaluations",
    "/imports",
    "/settings",
  ];
  for (const path of prefer) {
    if (
      isPathAllowedByMenuSelection(path, selection, resolvePolicyMenuPath)
    ) {
      return path;
    }
  }
  return menus[0] ?? "/dashboard";
}
