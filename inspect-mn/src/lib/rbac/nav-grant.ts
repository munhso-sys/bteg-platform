import { createHmac, timingSafeEqual } from "crypto";
import type { ModuleMenuSelection } from "@/lib/rbac/role-menu-visibility";

export type ModuleNavGrant = {
  v: 1;
  moduleId: string;
  menuIds: string[];
  submenuIds: Record<string, string[]>;
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

function signSecret() {
  return (
    process.env.POLICY_EMBED_SECRET?.trim() ||
    process.env.INSPECTION_EMBED_SECRET?.trim() ||
    ""
  );
}

export function signModuleNavGrant(
  moduleId: string,
  selection: ModuleMenuSelection | null,
): string | null {
  const key = signSecret();
  if (!key || !selection) return null;
  const payload: ModuleNavGrant = {
    v: 1,
    moduleId,
    menuIds: selection.menuIds,
    submenuIds: selection.submenuIds,
    exp: Date.now() + 12 * 60 * 60 * 1000,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", key).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyModuleNavGrant(
  token: string | null | undefined,
  expectedModuleId: string,
): ModuleNavGrant | null {
  if (!token) return null;
  const key = signSecret();
  if (!key) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = b64url(createHmac("sha256", key).update(body).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(
      fromB64url(body).toString("utf8"),
    ) as ModuleNavGrant;
    if (parsed?.v !== 1 || parsed.moduleId !== expectedModuleId) return null;
    if (typeof parsed.exp !== "number" || parsed.exp < Date.now()) return null;
    if (!Array.isArray(parsed.menuIds)) return null;
    return parsed;
  } catch {
    return null;
  }
}
