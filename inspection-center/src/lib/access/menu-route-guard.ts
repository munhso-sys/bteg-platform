/**
 * Enforce Role эрх inspection sidebar allowlists at the route level.
 */

import { authorizeNavigation } from "./nav-authorize";

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

export type MenuSelectionCheckOptions = {
  /** Override NAV_G1_ENFORCE (tests / UI filters). */
  g1?: boolean;
  /** Emit nav telemetry (middleware only; default off). */
  emit?: boolean;
  source?: string;
};

/**
 * No config (menuIds null AND submenuIds null): pre-G1 → ALLOW (compat);
 * NAV_G1_ENFORCE=1 → DENY (fail closed). With config: unmapped path → DENY,
 * known path must be allowlisted (shared N2 `authorizeNavigation` contract).
 * Navigation only — write permission is decided separately in write-access.ts.
 */
export function isPathAllowedByMenuSelection(
  pathname: string,
  selection: MenuRouteSelection,
  resolve: (pathname: string) => ResolvedMenuPath | null = resolveInspectionMenuPath,
  opts: MenuSelectionCheckOptions = {},
): boolean {
  return authorizeNavigation({
    moduleId: "inspection",
    pathname,
    selection,
    resolve,
    g1: opts.g1,
    emit: opts.emit ?? false,
    source: opts.source ?? "inspection-guard",
  }).allow;
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
