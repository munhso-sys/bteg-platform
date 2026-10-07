/**
 * Portal-native route enforcement for Role эрх menu allowlists.
 */

import type { ModuleMenuSelection } from "@/lib/rbac/role-menu-visibility";
import { NAV_MENU_CATALOG_VERSION } from "./module-menus";
import { authorizeNavigation } from "./nav-authorize";

export type ResolvedMenuPath = {
  menuId: string;
  submenuId?: string;
};

/** Map portal pathname → portal catalog menu id (module id for portal top-level). */
export function resolvePortalTopMenuPath(
  pathname: string,
): ResolvedMenuPath | null {
  const p = pathname.split("?")[0] || pathname;
  const map: Array<[string, string]> = [
    ["/inspection", "inspection"],
    ["/policy-compliance", "policy-compliance"],
    ["/guidance", "guidance"],
    ["/development", "development"],
    ["/process", "process"],
    ["/employee-voice", "employee-voice"],
    ["/risk-management", "risk-management"],
    ["/report-analysis", "report-analysis"],
    ["/smartmine", "smartmine"],
    ["/ai-assistant", "ai-assistant"],
    ["/policy-review", "policy-review"],
    ["/glossary", "glossary"],
    ["/settings", "settings"],
    ["/management-center", "management-center"],
  ];
  for (const [prefix, id] of map) {
    if (p === prefix || p.startsWith(`${prefix}/`)) {
      return { menuId: id };
    }
  }
  return null;
}

export function resolveRiskMenuPath(pathname: string): ResolvedMenuPath | null {
  const p = pathname.split("?")[0] || pathname;
  if (!p.startsWith("/risk-management")) return null;
  if (p === "/risk-management/register" || p.startsWith("/risk-management/register/")) {
    return { menuId: "/risk-management/register" };
  }
  if (p === "/risk-management/matrix" || p.startsWith("/risk-management/matrix/")) {
    return { menuId: "/risk-management/matrix" };
  }
  if (p === "/risk-management/work" || p.startsWith("/risk-management/work/")) {
    return { menuId: "/risk-management/work" };
  }
  if (p === "/risk-management/sources" || p.startsWith("/risk-management/sources/")) {
    return { menuId: "/risk-management/sources" };
  }
  if (p === "/risk-management/tree" || p.startsWith("/risk-management/tree/")) {
    return { menuId: "/risk-management/tree" };
  }
  return { menuId: "/risk-management" };
}

export function resolveVoiceMenuPath(pathname: string): ResolvedMenuPath | null {
  const p = pathname.split("?")[0] || pathname;
  if (!p.startsWith("/employee-voice")) return null;
  const prefixes = [
    "/employee-voice/inbox",
    "/employee-voice/actions",
    "/employee-voice/process",
    "/employee-voice/notify",
    "/employee-voice/telegram",
  ];
  for (const prefix of prefixes) {
    if (p === prefix || p.startsWith(`${prefix}/`)) {
      return { menuId: prefix };
    }
  }
  return { menuId: "/employee-voice" };
}

export function resolveGuidanceMenuPath(
  pathname: string,
): ResolvedMenuPath | null {
  const p = pathname.split("?")[0] || pathname;
  if (!p.startsWith("/guidance")) return null;
  if (p === "/guidance/other" || p.startsWith("/guidance/other/")) {
    return { menuId: "/guidance/other" };
  }
  return { menuId: "/guidance" };
}

export function resolveSettingsMenuPath(
  pathname: string,
): ResolvedMenuPath | null {
  const p = pathname.split("?")[0] || pathname;
  if (!p.startsWith("/settings")) return null;
  const exact = [
    "/settings/profile",
    "/settings/access-requests",
    "/settings/users",
    "/settings/roles",
    "/settings/temp-grants",
    "/settings/session",
  ];
  for (const href of exact) {
    if (p === href || p.startsWith(`${href}/`)) {
      return { menuId: href };
    }
  }
  return { menuId: "/settings" };
}

/**
 * Normalize selection fields for safe access.
 * Distinguishes NO CONFIG (null selection) from MALFORMED (object with bad fields).
 */
export function normalizeMenuSelection(
  selection: ModuleMenuSelection | null | undefined,
): ModuleMenuSelection | null {
  if (selection == null) return null;
  const menuIds = Array.isArray(selection.menuIds)
    ? selection.menuIds.filter((x): x is string => typeof x === "string")
    : [];
  const submenuIds: Record<string, string[]> = {};
  const raw = selection.submenuIds;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [parent, kids] of Object.entries(raw)) {
      if (!Array.isArray(kids)) continue;
      submenuIds[parent] = kids.filter((x): x is string => typeof x === "string");
    }
  }
  return { menuIds, submenuIds };
}

/** Reports (Тайлан шинжилгээ) route → catalog menu + ReportsNav submenu id. */
export function resolveReportMenuPath(
  pathname: string,
): ResolvedMenuPath | null {
  const p = pathname.split("?")[0] || pathname;
  if (p !== "/report-analysis" && !p.startsWith("/report-analysis/")) {
    return null;
  }
  // Keep in sync with ReportsNav TABS + MODULE_MENU_CATALOG report-analysis children.
  const tabs = [
    "/report-analysis/kpis",
    "/report-analysis/analysis",
    "/report-analysis/tree",
    "/report-analysis/operations",
    "/report-analysis/report",
    "/report-analysis/exports",
  ];
  for (const href of tabs) {
    if (p === href || p.startsWith(`${href}/`)) {
      return { menuId: "/report-analysis", submenuId: href };
    }
  }
  return { menuId: "/report-analysis", submenuId: "/report-analysis" };
}

export type MenuSelectionCheckOptions = {
  /** Telemetry/module tag; defaults to "portal". */
  moduleId?: string;
  /** Override NAV_G1_ENFORCE (tests). */
  g1?: boolean;
  emit?: boolean;
  source?: string;
};

/**
 * Pre-NAV-G1 (NAV_G1_ENFORCE off): null selection → ALLOW (no explicit config).
 * NAV_G1_ENFORCE=1: null selection → DENY (fail closed).
 * With explicit config: unmapped protected path → DENY; known path must be allowlisted.
 */
export function isPathAllowedByMenuSelection(
  pathname: string,
  selection: ModuleMenuSelection | null | undefined,
  resolve: (pathname: string) => ResolvedMenuPath | null,
  opts: MenuSelectionCheckOptions = {},
): boolean {
  // Malformed object (bad fields) still counts as explicit config (empty allowlist);
  // only a null/undefined selection means NO CONFIG.
  const normalized = normalizeMenuSelection(selection);
  return authorizeNavigation({
    moduleId: opts.moduleId ?? "portal",
    pathname,
    selection: normalized,
    resolve,
    g1: opts.g1,
    emit: opts.emit,
    source: opts.source ?? "portal-guard",
    catalogVersion: NAV_MENU_CATALOG_VERSION,
  }).allow;
}
