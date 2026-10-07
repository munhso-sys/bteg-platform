export type ModuleNavGrant = {
  v: 1;
  moduleId: string;
  menuIds: string[];
  submenuIds: Record<string, string[]>;
  exp: number;
};

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
        process.env.PROCESS_NAV_SECRET?.trim(),
      ].filter((s): s is string => Boolean(s)),
    ),
  ];
}

export async function verifyModuleNavGrant(
  token: string | null | undefined,
  expectedModuleId: string,
): Promise<ModuleNavGrant | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  let ok = false;
  for (const key of verifySecrets()) {
    const expected = await hmacSha256Base64Url(body, key);
    if (timingSafeEqualStr(sig, expected)) {
      ok = true;
      break;
    }
  }
  if (!ok) return null;
  try {
    const json = new TextDecoder().decode(bytesFromB64url(body));
    const parsed = JSON.parse(json) as ModuleNavGrant;
    if (parsed?.v !== 1 || parsed.moduleId !== expectedModuleId) return null;
    if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
    if (!Array.isArray(parsed.menuIds)) return null;
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
    return { ...parsed, menuIds, submenuIds };
  } catch {
    return null;
  }
}

export function resolveProcessMenuPath(
  pathname: string,
): { menuId: string } | null {
  const p = pathname.split("?")[0] || pathname;
  const ids = ["/dashboard", "/processes", "/documents", "/nodes", "/settings"];
  for (const id of ids) {
    if (p === id || p.startsWith(`${id}/`)) return { menuId: id };
  }
  return null;
}

export function isProcessPathAllowed(
  pathname: string,
  grant: ModuleNavGrant | null,
): boolean {
  if (!grant) return true;
  const hit = resolveProcessMenuPath(pathname);
  if (!hit) return false;
  return (grant.menuIds ?? []).includes(hit.menuId);
}

/**
 * N1-04: once a signed nav grant has been seen (valid or invalid), the session
 * stays under enforcement — invalid/expired must not degrade to unrestricted.
 * Truly never-supplied nav (no enforce marker, no token) → pre-NAV-G1 compat.
 */
export function isNavEnforcementActive(
  enforceCookie: string | null | undefined,
): boolean {
  return enforceCookie === "1";
}

export function firstAllowedProcessPath(grant: ModuleNavGrant): string {
  const prefer = [
    "/dashboard",
    "/processes",
    "/documents",
    "/nodes",
    "/settings",
  ];
  for (const path of prefer) {
    if (isProcessPathAllowed(path, grant)) return path;
  }
  return grant.menuIds[0] || "/dashboard";
}

export const PROCESS_NAV_COOKIE = "process_nav_grant";
/** Marks that this browser/iframe session entered under signed-nav enforcement. */
export const PROCESS_NAV_ENFORCE_COOKIE = "process_nav_enforce";
