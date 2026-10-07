/**
 * Shared navigation authorization contract (Wave N2) + NAV-G1 enforce flag.
 *
 * Canonical copy: inspect-mn/src/lib/rbac/nav-authorize.ts
 * Mirrored byte-for-byte into each module app (src/lib/access/nav-authorize.ts);
 * inspect-mn `nav-authorize.n2.test.ts` fails when a copy drifts.
 * Pure + edge-runtime safe (no node imports).
 *
 * Decision table (selection = verified, explicit menu allowlist config):
 *   token invalid / expired            → DENY (re-embed)       [never degrade to open]
 *   no config + prior enforcement      → DENY config_missing   [N1-04 sticky session]
 *   no config + NAV_G1_ENFORCE=1       → DENY config_missing   [post-G1 fail closed]
 *   no config + G1 off                 → ALLOW compat_allow    [pre-G1 compatibility]
 *   config malformed (wrong types)     → DENY selection_malformed
 *   config + route unmapped            → DENY route_unmapped
 *   config + menu not allowlisted      → DENY menu_denied
 *   config + submenu not allowlisted   → DENY submenu_denied (only when the parent
 *                                         has an explicit submenu list)
 *   config + allowlisted               → ALLOW allowed
 */

import {
  emitNavEvent,
  type NavTelemetryEvent,
} from "./nav-telemetry";

/** Result of a module route resolver (pathname → catalog menu/submenu id). */
export type NavResolvedPath = {
  menuId: string;
  submenuId?: string;
};

export type NavSelectionInput =
  | {
      /** null/undefined = no top-level restriction configured. */
      menuIds?: string[] | null;
      /** missing parent key = all children of that parent allowed. */
      submenuIds?: Record<string, string[]> | null;
    }
  | null
  | undefined;

/** State of the signed grant/cookie that produced `selection`. */
export type NavTokenState = "none" | "valid" | "invalid" | "expired";

export type NavDenyReason =
  | "token_invalid"
  | "token_expired"
  | "config_missing"
  | "route_unmapped"
  | "selection_malformed"
  | "menu_denied"
  | "submenu_denied";

export type NavDecision =
  | {
      allow: true;
      reason: "allowed" | "compat_allow";
      menuId?: string;
      submenuId?: string;
    }
  | {
      allow: false;
      reason: NavDenyReason;
      /** "reembed" = caller should drop the grant and ask portal for a fresh one. */
      action: "deny" | "reembed";
      menuId?: string;
      submenuId?: string;
    };

export type AuthorizeNavigationInput = {
  moduleId: string;
  pathname: string;
  selection: NavSelectionInput;
  resolve: (pathname: string) => NavResolvedPath | null;
  /** Defaults to "valid" when a selection exists, otherwise "none". */
  tokenState?: NavTokenState;
  /** True when this session was already seen under signed-nav enforcement. */
  enforceMarker?: boolean;
  /** Override for tests; defaults to isNavG1Enforce(). */
  g1?: boolean;
  catalogVersion?: string | null;
  /** Set false for non-terminal probes (e.g. "first allowed path" scans). */
  emit?: boolean;
  /** Telemetry source tag (e.g. "middleware", "layout"). */
  source?: string;
};

/**
 * Explicit NAV-G1 fail-closed flag. Server-only env, default OFF.
 * When "1": missing/null config is DENY instead of compat ALLOW.
 */
export function isNavG1Enforce(env?: { NAV_G1_ENFORCE?: string }): boolean {
  const value = env ? env.NAV_G1_ENFORCE : process.env.NAV_G1_ENFORCE;
  return value === "1";
}

function hasConfig(selection: NavSelectionInput): boolean {
  if (selection == null) return false;
  const sub = selection.submenuIds;
  return (
    Array.isArray(selection.menuIds) ||
    (sub != null && typeof sub === "object" && !Array.isArray(sub))
  );
}

/** Config object present but with wrongly-typed fields (never "no config"). */
function isMalformed(selection: NavSelectionInput): boolean {
  if (selection == null || typeof selection !== "object") return false;
  const { menuIds, submenuIds } = selection as {
    menuIds?: unknown;
    submenuIds?: unknown;
  };
  if (menuIds != null && !Array.isArray(menuIds)) return true;
  if (
    submenuIds != null &&
    (typeof submenuIds !== "object" || Array.isArray(submenuIds))
  ) {
    return true;
  }
  return false;
}

function safeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((x): x is string => typeof x === "string")
    : [];
}

const EVENT_BY_REASON: Record<string, NavTelemetryEvent> = {
  allowed: "nav.allow",
  compat_allow: "nav.compat_allow",
  config_missing: "nav.config_missing",
  token_invalid: "nav.token_invalid",
  token_expired: "nav.token_expired",
  route_unmapped: "nav.route_unmapped",
  menu_denied: "nav.deny",
  submenu_denied: "nav.deny",
  selection_malformed: "nav.deny",
};

function finish(
  input: AuthorizeNavigationInput,
  g1: boolean,
  decision: NavDecision,
): NavDecision {
  if (input.emit !== false) {
    emitNavEvent(EVENT_BY_REASON[decision.reason] ?? "nav.deny", {
      moduleId: input.moduleId,
      path: input.pathname,
      menuId: decision.menuId,
      submenuId: decision.submenuId,
      reason: decision.reason,
      source: input.source,
      catalogVersion: input.catalogVersion ?? undefined,
      g1,
    });
  }
  return decision;
}

export function authorizeNavigation(
  input: AuthorizeNavigationInput,
): NavDecision {
  const g1 = input.g1 ?? isNavG1Enforce();
  const tokenState: NavTokenState =
    input.tokenState ?? (input.selection != null ? "valid" : "none");

  // A token that was presented but cannot be trusted never degrades to open.
  if (tokenState === "invalid") {
    return finish(input, g1, {
      allow: false,
      reason: "token_invalid",
      action: "reembed",
    });
  }
  if (tokenState === "expired") {
    return finish(input, g1, {
      allow: false,
      reason: "token_expired",
      action: "reembed",
    });
  }

  // Malformed config must fail closed — it is NOT "no config" (no compat allow).
  if (isMalformed(input.selection)) {
    return finish(input, g1, {
      allow: false,
      reason: "selection_malformed",
      action: "deny",
    });
  }

  if (!hasConfig(input.selection)) {
    if (input.enforceMarker || g1) {
      return finish(input, g1, {
        allow: false,
        reason: "config_missing",
        action: "reembed",
      });
    }
    return finish(input, g1, { allow: true, reason: "compat_allow" });
  }

  const selection = input.selection!;
  const hit = input.resolve(input.pathname);
  if (!hit) {
    return finish(input, g1, {
      allow: false,
      reason: "route_unmapped",
      action: "deny",
    });
  }

  const ids = {
    menuId: hit.menuId,
    ...(hit.submenuId ? { submenuId: hit.submenuId } : {}),
  };

  if (
    Array.isArray(selection.menuIds) &&
    !safeStringArray(selection.menuIds).includes(hit.menuId)
  ) {
    return finish(input, g1, {
      allow: false,
      reason: "menu_denied",
      action: "deny",
      ...ids,
    });
  }

  const sub = selection.submenuIds;
  if (
    hit.submenuId &&
    sub != null &&
    typeof sub === "object" &&
    !Array.isArray(sub) &&
    Object.prototype.hasOwnProperty.call(sub, hit.menuId)
  ) {
    if (!safeStringArray(sub[hit.menuId]).includes(hit.submenuId)) {
      return finish(input, g1, {
        allow: false,
        reason: "submenu_denied",
        action: "deny",
        ...ids,
      });
    }
  }

  return finish(input, g1, { allow: true, reason: "allowed", ...ids });
}
