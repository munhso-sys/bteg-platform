import {
  authorizeNavigation,
  type NavDecision,
  type NavTokenState,
} from "./nav-authorize";

export type ModuleNavGrant = {
  v: 1;
  moduleId: string;
  menuIds: string[];
  submenuIds: Record<string, string[]>;
  exp: number;
  /** Optional menu-catalog version stamped by portal (absent = v1 route hrefs). */
  catalogVersion?: string;
};

export type NavGrantInspection =
  | { state: "valid"; grant: ModuleNavGrant }
  | { state: "invalid" }
  | { state: "expired" };

function b64urlFromBytes(bytes: ArrayBuffer | Uint8Array) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < arr.length; i += 1) bin += String.fromCharCode(arr[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function bytesFromB64url(input: string) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

function timingSafeEqualStr(a: string, b: string) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function hmacSha256Base64Url(body: string, key: string) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(body));
  return b64urlFromBytes(sig);
}

function verifySecrets() {
  return [
    ...new Set(
      [
        process.env.POLICY_EMBED_SECRET?.trim(),
        process.env.INSPECTION_EMBED_SECRET?.trim(),
        process.env.DEVELOPMENT_NAV_SECRET?.trim(),
      ].filter((s): s is string => Boolean(s)),
    ),
  ];
}

/** Like verifyModuleNavGrant but distinguishes expired from invalid (telemetry). */
export async function inspectModuleNavGrant(
  token: string | null | undefined,
  expectedModuleId: string,
): Promise<NavGrantInspection> {
  if (!token) return { state: "invalid" };
  const [body, sig] = token.split(".");
  if (!body || !sig) return { state: "invalid" };
  let ok = false;
  for (const key of verifySecrets()) {
    const expected = await hmacSha256Base64Url(body, key);
    if (timingSafeEqualStr(sig, expected)) {
      ok = true;
      break;
    }
  }
  if (!ok) return { state: "invalid" };
  try {
    const json = new TextDecoder().decode(bytesFromB64url(body));
    const parsed = JSON.parse(json) as ModuleNavGrant;
    if (parsed?.v !== 1 || parsed.moduleId !== expectedModuleId) {
      return { state: "invalid" };
    }
    if (typeof parsed.exp !== "number") return { state: "invalid" };
    if (parsed.exp < Date.now()) return { state: "expired" };
    if (!Array.isArray(parsed.menuIds)) return { state: "invalid" };
    const menuIds = parsed.menuIds.filter(
      (x): x is string => typeof x === "string",
    );
    const submenuIds: Record<string, string[]> = {};
    const rawSub = parsed.submenuIds;
    if (rawSub && typeof rawSub === "object" && !Array.isArray(rawSub)) {
      for (const [k, v] of Object.entries(rawSub)) {
        if (!Array.isArray(v)) continue;
        submenuIds[k] = v.filter((x): x is string => typeof x === "string");
      }
    }
    const catalogVersion =
      typeof parsed.catalogVersion === "string"
        ? parsed.catalogVersion
        : undefined;
    return {
      state: "valid",
      grant: { ...parsed, menuIds, submenuIds, catalogVersion },
    };
  } catch {
    return { state: "invalid" };
  }
}

export async function verifyModuleNavGrant(
  token: string | null | undefined,
  expectedModuleId: string,
): Promise<ModuleNavGrant | null> {
  const r = await inspectModuleNavGrant(token, expectedModuleId);
  return r.state === "valid" ? r.grant : null;
}

export function resolveDevelopmentMenuPath(
  pathname: string,
): { menuId: string } | null {
  const p = pathname.split("?")[0] || pathname;
  const ids = [
    "/dashboard",
    "/projects",
    "/program",
    "/results",
    "/reports",
    "/feedback",
    "/settings",
  ];
  for (const id of ids) {
    if (p === id || p.startsWith(`${id}/`)) return { menuId: id };
  }
  return null;
}

export type DevelopmentNavDecisionOptions = {
  tokenState?: NavTokenState;
  /** Session previously under signed-nav enforcement (enforce cookie). */
  enforceMarker?: boolean;
  /** Override NAV_G1_ENFORCE (tests). */
  g1?: boolean;
  emit?: boolean;
  source?: string;
};

/**
 * Shared N2 contract for Development. grant === null:
 *  - NAV_G1_ENFORCE off + no enforce marker → compat ALLOW (pre-G1)
 *  - NAV_G1_ENFORCE=1 or enforce marker     → DENY (re-embed)
 */
export function decideDevelopmentNavigation(
  pathname: string,
  grant: ModuleNavGrant | null,
  opts: DevelopmentNavDecisionOptions = {},
): NavDecision {
  return authorizeNavigation({
    moduleId: "development",
    pathname,
    selection: grant
      ? { menuIds: grant.menuIds ?? [], submenuIds: grant.submenuIds ?? {} }
      : null,
    resolve: resolveDevelopmentMenuPath,
    tokenState: opts.tokenState,
    enforceMarker: opts.enforceMarker,
    g1: opts.g1,
    emit: opts.emit ?? false,
    source: opts.source ?? "development-nav",
    catalogVersion: grant?.catalogVersion,
  });
}

/** Pure path check (no telemetry). Null grant follows NAV_G1_ENFORCE (default off → allow). */
export function isDevelopmentPathAllowed(
  pathname: string,
  grant: ModuleNavGrant | null,
  g1?: boolean,
): boolean {
  return decideDevelopmentNavigation(pathname, grant, { g1, emit: false })
    .allow;
}

export function isNavEnforcementActive(
  enforceCookie: string | null | undefined,
): boolean {
  return enforceCookie === "1";
}

export function firstAllowedDevelopmentPath(grant: ModuleNavGrant): string {
  const prefer = [
    "/dashboard",
    "/projects",
    "/program",
    "/results",
    "/reports",
    "/feedback",
    "/settings",
  ];
  for (const path of prefer) {
    if (isDevelopmentPathAllowed(path, grant)) return path;
  }
  return grant.menuIds[0] || "/dashboard";
}

export const DEVELOPMENT_NAV_COOKIE = "development_nav_grant";
export const DEVELOPMENT_NAV_ENFORCE_COOKIE = "development_nav_enforce";
