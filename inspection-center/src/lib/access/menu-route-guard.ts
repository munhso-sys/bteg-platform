/**
 * Enforce Role эрх inspection sidebar allowlists at the route level.
 */

export type MenuRouteSelection = {
  menuIds: string[] | null;
  submenuIds: Record<string, string[]> | null;
};

export type ResolvedMenuPath = {
  menuId: string;
  submenuId?: string;
};

export function resolveInspectionMenuPath(
  pathname: string,
): ResolvedMenuPath | null {
  const p = pathname.split("?")[0] || pathname;

  if (p === "/settings/data" || p.startsWith("/settings/data/")) {
    return { menuId: "/settings", submenuId: "/settings/data" };
  }
  if (
    p === "/settings/org-templates" ||
    p.startsWith("/settings/org-templates/")
  ) {
    return { menuId: "/settings", submenuId: "/settings/org-templates" };
  }
  if (p === "/settings" || p.startsWith("/settings/")) {
    return { menuId: "/settings", submenuId: "/settings" };
  }

  if (p === "/plans/by-type" || p.startsWith("/plans/by-type/")) {
    return { menuId: "/plans", submenuId: "/plans/by-type" };
  }
  if (p === "/plans/annual" || p.startsWith("/plans/annual/")) {
    return { menuId: "/plans", submenuId: "/plans/annual" };
  }
  if (p === "/plans/gaps" || p.startsWith("/plans/gaps/")) {
    return { menuId: "/plans", submenuId: "/plans/gaps" };
  }
  if (p === "/plans" || p.startsWith("/plans/")) {
    return { menuId: "/plans", submenuId: "/plans" };
  }

  if (p === "/findings/state" || p.startsWith("/findings/state/")) {
    return { menuId: "/findings", submenuId: "/findings/state" };
  }
  if (p === "/findings/night" || p.startsWith("/findings/night/")) {
    return { menuId: "/findings", submenuId: "/findings/night" };
  }
  if (p === "/findings/joint" || p.startsWith("/findings/joint/")) {
    return { menuId: "/findings", submenuId: "/findings/joint" };
  }
  if (p === "/findings" || p.startsWith("/findings/")) {
    return { menuId: "/findings", submenuId: "/findings" };
  }

  if (p === "/actions/open" || p.startsWith("/actions/open/")) {
    return { menuId: "/actions", submenuId: "/actions/open" };
  }
  if (p === "/actions/resolved" || p.startsWith("/actions/resolved/")) {
    return { menuId: "/actions", submenuId: "/actions/resolved" };
  }
  if (p === "/actions" || p.startsWith("/actions/")) {
    return { menuId: "/actions", submenuId: "/actions" };
  }

  if (p === "/dashboard" || p.startsWith("/dashboard/")) {
    return { menuId: "/dashboard" };
  }
  if (p === "/runs" || p.startsWith("/runs/")) return { menuId: "/runs" };
  if (p === "/templates" || p.startsWith("/templates/")) {
    return { menuId: "/templates" };
  }
  if (p === "/evidence" || p.startsWith("/evidence/")) {
    return { menuId: "/evidence" };
  }
  if (p === "/analytics" || p.startsWith("/analytics/")) {
    return { menuId: "/analytics" };
  }
  if (p === "/imports" || p.startsWith("/imports/")) {
    return { menuId: "/imports" };
  }

  return null;
}

export function isPathAllowedByMenuSelection(
  pathname: string,
  selection: MenuRouteSelection,
  resolve: (pathname: string) => ResolvedMenuPath | null = resolveInspectionMenuPath,
): boolean {
  const hasMenuConfig = Array.isArray(selection.menuIds);
  if (!hasMenuConfig && selection.submenuIds == null) return true;

  const hit = resolve(pathname);
  if (!hit) {
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

export function firstAllowedInspectionPath(
  selection: MenuRouteSelection,
): string {
  const candidates = [
    "/dashboard",
    "/plans",
    "/runs",
    "/findings",
    "/actions",
    "/templates",
    "/evidence",
    "/analytics",
    "/imports",
    "/settings",
  ];
  for (const path of candidates) {
    if (isPathAllowedByMenuSelection(path, selection)) return path;
  }
  return (selection.menuIds && selection.menuIds[0]) || "/dashboard";
}
