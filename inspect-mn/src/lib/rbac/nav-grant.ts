import { createHmac, timingSafeEqual } from "crypto";
import type { ModuleMenuSelection } from "@/lib/rbac/role-menu-visibility";
import { NAV_MENU_CATALOG_VERSION } from "./module-menus";

/**
 * Signed per-module nav grant (portal → Process / Development iframes).
 *
 * Cookie contract (set by the receiving module middleware, NOT by portal):
 * the grant is re-persisted in an HttpOnly cookie + a `*_nav_enforce` marker.
 * Secure / SameSite flags are env-aware: production and hosted (Vercel)
 * iframes require `Secure; SameSite=None`. Do NOT weaken `Secure` in
 * production; any local-dev relaxation must be gated on a non-hosted runtime.
 *
 * Secrets: PROCESS_NAV_SECRET / DEVELOPMENT_NAV_SECRET are preferred per
 * module; POLICY_EMBED_SECRET / INSPECTION_EMBED_SECRET remain a rollout
 * fallback. Never log tokens or secrets.
 */
export type ModuleNavGrant = {
  v: 1;
  moduleId: string;
  menuIds: string[];
  submenuIds: Record<string, string[]>;
  exp: number;
  /** Optional menu-catalog version (v1 = route-href ids). Absent = v1. */
  catalogVersion?: string;
};

export type NavGrantEnv = Record<string, string | undefined>;

export type NavGrantInspection =
  | { state: "valid"; grant: ModuleNavGrant }
  | { state: "invalid" }
  | { state: "expired" };

function b64url(input: Buffer | string) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input, "utf8");
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64url(input: string) {
  const pad = input.length % 4 === 0 ? "" : "=".repeat(4 - (input.length % 4));
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + pad;
  return Buffer.from(b64, "base64");
}

function moduleSecret(moduleId: string, env: NavGrantEnv): string | undefined {
  if (moduleId === "process") return env.PROCESS_NAV_SECRET?.trim() || undefined;
  if (moduleId === "development") {
    return env.DEVELOPMENT_NAV_SECRET?.trim() || undefined;
  }
  return undefined;
}

/** Signing key: per-module nav secret first, embed secrets as rollout fallback. */
function signSecret(moduleId: string, env: NavGrantEnv) {
  return (
    moduleSecret(moduleId, env) ||
    env.POLICY_EMBED_SECRET?.trim() ||
    env.INSPECTION_EMBED_SECRET?.trim() ||
    ""
  );
}

/** Keys the portal itself accepts when verifying (mirrors module verifiers). */
function verifySecrets(moduleId: string, env: NavGrantEnv) {
  return [
    ...new Set(
      [
        moduleSecret(moduleId, env),
        env.POLICY_EMBED_SECRET?.trim(),
        env.INSPECTION_EMBED_SECRET?.trim(),
      ].filter((s): s is string => Boolean(s)),
    ),
  ];
}

export type SignModuleNavGrantOptions = {
  /** Token lifetime in ms (default 12h). Tests may pass a negative value. */
  ttlMs?: number;
  /** Env source (default process.env). */
  env?: NavGrantEnv;
};

export function signModuleNavGrant(
  moduleId: string,
  selection: ModuleMenuSelection | null,
  opts: SignModuleNavGrantOptions = {},
): string | null {
  const env = opts.env ?? process.env;
  const key = signSecret(moduleId, env);
  if (!key || !selection) return null;
  const payload: ModuleNavGrant = {
    v: 1,
    moduleId,
    menuIds: selection.menuIds,
    submenuIds: selection.submenuIds,
    exp: Date.now() + (opts.ttlMs ?? 12 * 60 * 60 * 1000),
    catalogVersion: NAV_MENU_CATALOG_VERSION,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", key).update(body).digest());
  return `${body}.${sig}`;
}

export function inspectModuleNavGrant(
  token: string | null | undefined,
  expectedModuleId: string,
  env: NavGrantEnv = process.env,
): NavGrantInspection {
  if (!token) return { state: "invalid" };
  const [body, sig] = token.split(".");
  if (!body || !sig) return { state: "invalid" };
  const b = Buffer.from(sig);
  const sigOk = verifySecrets(expectedModuleId, env).some((key) => {
    const a = Buffer.from(b64url(createHmac("sha256", key).update(body).digest()));
    return a.length === b.length && timingSafeEqual(a, b);
  });
  if (!sigOk) return { state: "invalid" };
  try {
    const parsed = JSON.parse(
      fromB64url(body).toString("utf8"),
    ) as ModuleNavGrant;
    if (parsed?.v !== 1 || parsed.moduleId !== expectedModuleId) {
      return { state: "invalid" };
    }
    if (typeof parsed.exp !== "number") return { state: "invalid" };
    if (parsed.exp < Date.now()) return { state: "expired" };
    if (!Array.isArray(parsed.menuIds)) return { state: "invalid" };
    return { state: "valid", grant: parsed };
  } catch {
    return { state: "invalid" };
  }
}

export function verifyModuleNavGrant(
  token: string | null | undefined,
  expectedModuleId: string,
  env: NavGrantEnv = process.env,
): ModuleNavGrant | null {
  const r = inspectModuleNavGrant(token, expectedModuleId, env);
  return r.state === "valid" ? r.grant : null;
}
