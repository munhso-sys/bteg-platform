import { createHmac, timingSafeEqual } from "crypto";
import {
  resolvePolicyEmbedSignSecret,
  resolvePolicyEmbedVerifySecrets,
} from "./embed-secret-config";

/** full=edit; view=read-only Role эрх; position=/my workplace; unit=org unit */
export type PolicyEmbedMode = "full" | "view" | "position" | "unit";

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
  /** Optional allowlist of policy sidebar menu hrefs for this role. */
  menus?: string[] | null;
  /** Optional allowlist of submenu hrefs keyed by parent menu href. */
  submenus?: Record<string, string[]> | null;
  exp: number;
};

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

export function signPolicyEmbedToken(claims: Omit<PolicyEmbedClaims, "v">) {
  const key = resolvePolicyEmbedSignSecret();
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
  for (const key of resolvePolicyEmbedVerifySecrets()) {
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
      parsed.mode !== "view" &&
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
