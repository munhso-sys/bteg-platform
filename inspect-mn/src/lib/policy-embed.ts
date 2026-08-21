import { createHmac, timingSafeEqual } from "crypto";
import { UNIT_FINDINGS_ROLES } from "@/lib/rbac/types";

/** Roles that only see their own job-position obligations. */
export const POSITION_SCOPED_ROLES = [
  "employee",
  "assistant",
  "specialist",
  "junior_specialist",
  "dxsh_specialist",
] as const;

export type PolicyEmbedMode = "full" | "position" | "unit";

export type PolicyEmbedClaims = {
  v: 1;
  uid: string;
  role: string | null;
  positionId: string | null;
  positionName: string | null;
  heltesId?: string | null;
  albaId?: string | null;
  heltesName?: string | null;
  albaName?: string | null;
  mode: PolicyEmbedMode;
  exp: number;
};

function signSecret() {
  return (
    process.env.POLICY_EMBED_SECRET?.trim() ||
    "inspect-platform-policy-embed-v1" ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    ""
  );
}

function verifySecrets() {
  const list = [
    process.env.POLICY_EMBED_SECRET?.trim(),
    "inspect-platform-policy-embed-v1",
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  ].filter((s): s is string => Boolean(s));
  return [...new Set(list)];
}

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

export function isPositionScopedRole(roleId: string | null | undefined) {
  return Boolean(
    roleId &&
      (POSITION_SCOPED_ROLES as readonly string[]).includes(roleId),
  );
}

export function isUnitScopedRole(roleId: string | null | undefined) {
  return Boolean(
    roleId && UNIT_FINDINGS_ROLES.includes(roleId as (typeof UNIT_FINDINGS_ROLES)[number]),
  );
}

export function signPolicyEmbedToken(claims: Omit<PolicyEmbedClaims, "v">) {
  const key = signSecret();
  if (!key) return null;
  const payload: PolicyEmbedClaims = { v: 1, ...claims };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", key).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyPolicyEmbedToken(
  token: string | null | undefined,
): PolicyEmbedClaims | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const a = Buffer.from(sig);
  let ok = false;
  for (const key of verifySecrets()) {
    const expected = b64url(createHmac("sha256", key).update(body).digest());
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) {
      ok = true;
      break;
    }
  }
  if (!ok) return null;
  try {
    const parsed = JSON.parse(fromB64url(body).toString("utf8")) as PolicyEmbedClaims;
    if (parsed?.v !== 1 || typeof parsed.exp !== "number") return null;
    if (parsed.exp < Date.now()) return null;
    if (
      parsed.mode !== "full" &&
      parsed.mode !== "position" &&
      parsed.mode !== "unit"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
