/**
 * Soft-scope remint navigation decision (Wave N1).
 * Choice A: fail closed / require fresh signed embed when prior cookie is
 * present but unverifiable — never mint soft claims that drop an enforced
 * session into unrestricted navigation.
 */

import { isNavG1Enforce } from "./nav-authorize";

export type SoftRemintNavDecision =
  | {
      action: "proceed";
      menus: string[] | null;
      submenus: Record<string, string[]> | null;
    }
  | {
      action: "fail_closed_reembed";
      /**
       * PRIOR_COOKIE_INVALID: prior cookie present but unverifiable.
       * NAV_CONFIG_MISSING: NAV_G1_ENFORCE=1 and no signed nav claims to preserve.
       */
      reason: "PRIOR_COOKIE_INVALID" | "NAV_CONFIG_MISSING";
    };

function normalizeMenus(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null; // malformed → treat as absent for preserve path
  return raw.filter((x): x is string => typeof x === "string");
}

function normalizeSubmenus(
  raw: unknown,
): Record<string, string[]> | null {
  if (raw == null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(v)) continue;
    out[k] = v.filter((x): x is string => typeof x === "string");
  }
  return out;
}

/**
 * @param cookiePresent - POLICY_SCOPE_COOKIE existed on the request
 * @param priorClaims - verified prior claims, or null if missing/invalid
 * @param g1 - NAV_G1_ENFORCE override (default: env). When on, a soft re-mint
 *   that would carry NO nav claims fails closed instead of minting an
 *   unrestricted session.
 */
export function decideSoftRemintNavigation(args: {
  cookiePresent: boolean;
  priorClaims: {
    menus?: unknown;
    submenus?: unknown;
  } | null;
  g1?: boolean;
}): SoftRemintNavDecision {
  const { cookiePresent, priorClaims } = args;
  const g1 = args.g1 ?? isNavG1Enforce();

  // Enforced session cookie present but unverifiable → fail closed (N1-03 A)
  if (cookiePresent && !priorClaims) {
    return { action: "fail_closed_reembed", reason: "PRIOR_COOKIE_INVALID" };
  }

  if (!priorClaims) {
    // Soft-first entry (no prior cookie): pre-NAV-G1 — no menus yet
    if (g1) {
      return { action: "fail_closed_reembed", reason: "NAV_CONFIG_MISSING" };
    }
    return { action: "proceed", menus: null, submenus: null };
  }

  const menus = normalizeMenus(priorClaims.menus);
  const submenus = normalizeSubmenus(priorClaims.submenus);
  if (g1 && !hasExplicitNavClaims(menus, submenus)) {
    return { action: "fail_closed_reembed", reason: "NAV_CONFIG_MISSING" };
  }

  return { action: "proceed", menus, submenus };
}

/** True when menu allowlist enforcement should run for these claims. */
export function hasExplicitNavClaims(
  menus: string[] | null | undefined,
  submenus: Record<string, string[]> | null | undefined,
): boolean {
  return Array.isArray(menus) || (submenus != null && typeof submenus === "object");
}
