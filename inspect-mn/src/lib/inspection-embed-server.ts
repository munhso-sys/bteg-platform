import { createHmac, timingSafeEqual } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import type { PermissionId, RoleId, UserProfile } from "@/lib/rbac/types";
import { resolveUnitScope } from "@/lib/rbac/unit-scope";
import { isUnitScopedRole } from "@/lib/policy-embed";

export type InspectionEmbedMode = "full" | "unit";

export type InspectionEmbedClaims = {
  v: 1;
  uid: string;
  role: string | null;
  heltesId: string | null;
  albaId: string | null;
  heltesName: string | null;
  albaName: string | null;
  mode: InspectionEmbedMode;
  exp: number;
};

const EMBED_BUILD_TIMEOUT_MS = 8_000;

function signSecret() {
  return (
    process.env.INSPECTION_EMBED_SECRET?.trim() ||
    process.env.POLICY_EMBED_SECRET?.trim() ||
    "inspect-platform-policy-embed-v1" ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    ""
  );
}

function verifySecrets() {
  return [
    ...new Set(
      [
        process.env.INSPECTION_EMBED_SECRET?.trim(),
        process.env.POLICY_EMBED_SECRET?.trim(),
        "inspect-platform-policy-embed-v1",
        process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
      ].filter((s): s is string => Boolean(s)),
    ),
  ];
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

export function signInspectionEmbedToken(
  claims: Omit<InspectionEmbedClaims, "v">,
) {
  const key = signSecret();
  if (!key) return null;
  const payload: InspectionEmbedClaims = { v: 1, ...claims };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", key).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyInspectionEmbedToken(
  token: string | null | undefined,
): InspectionEmbedClaims | null {
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
    const parsed = JSON.parse(
      fromB64url(body).toString("utf8"),
    ) as InspectionEmbedClaims;
    if (parsed?.v !== 1 || typeof parsed.exp !== "number") return null;
    if (parsed.exp < Date.now()) return null;
    if (parsed.mode !== "full" && parsed.mode !== "unit") return null;
    return parsed;
  } catch {
    return null;
  }
}

async function loadPermissions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  userId: string,
  roleId: RoleId | null,
) {
  const perms = new Set<PermissionId>();
  if (roleId) {
    const { data: rolePerms } = await db
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", roleId);
    for (const row of rolePerms ?? []) {
      perms.add(row.permission_id as PermissionId);
    }
  }
  return perms;
}

async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${ms}ms`)),
          ms,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function buildInspectionEmbedOptionsInner(): Promise<{
  entryPath: string;
  query: Record<string, string>;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = hasServiceRole() ? createAdminClient() : supabase;
  const { data: profile } = await db
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const p = profile as UserProfile | null;
  const roleId = (p?.role_id ?? null) as RoleId | null;
  const permissions =
    p && p.status === "active"
      ? await loadPermissions(db, user.id, roleId)
      : new Set<PermissionId>();

  const canEdit =
    permissions.has("module.inspection.edit") ||
    permissions.has("portal.admin") ||
    roleId === "admin";

  const unit = resolveUnitScope(p, roleId);
  const mode: InspectionEmbedMode =
    !canEdit && isUnitScopedRole(roleId) && unit.active ? "unit" : "full";

  const token = signInspectionEmbedToken({
    uid: user.id,
    role: roleId,
    heltesId: unit.heltesId,
    albaId: unit.albaId,
    heltesName: unit.heltesName,
    albaName: unit.albaName,
    mode,
    exp: Date.now() + 12 * 60 * 60 * 1000,
  });

  const softQuery: Record<string, string> = {
    scope: mode,
    ...(unit.heltesId ? { heltes_id: unit.heltesId } : {}),
    ...(unit.albaId ? { alba_id: unit.albaId } : {}),
    ...(unit.heltesName ? { heltes_name: unit.heltesName } : {}),
    ...(unit.albaName ? { alba_name: unit.albaName } : {}),
  };

  if (!token) {
    return mode === "unit"
      ? { entryPath: "/dashboard", query: softQuery }
      : null;
  }

  return {
    entryPath: "/dashboard",
    query: { embed: token, ...softQuery },
  };
}

export async function buildInspectionEmbedOptions(): Promise<{
  entryPath: string;
  query: Record<string, string>;
} | null> {
  try {
    return await withTimeout(
      buildInspectionEmbedOptionsInner(),
      EMBED_BUILD_TIMEOUT_MS,
      "inspection embed",
    );
  } catch (error) {
    console.error(
      "[inspection-embed] build failed; embedding without token",
      error,
    );
    // Keep the iframe usable even if auth/profile lookup is slow or down.
    return { entryPath: "/dashboard", query: {} };
  }
}
