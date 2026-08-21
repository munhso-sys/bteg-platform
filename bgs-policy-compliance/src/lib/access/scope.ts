import { cookies } from "next/headers";
import {
  isPositionScoped,
  isRestrictedScope,
  POLICY_SCOPE_COOKIE,
  verifyPolicyEmbedToken,
  type PolicyEmbedClaims,
} from "@/lib/access/embed";
import { resolveJobPositionRef } from "@/lib/access/resolve-position";

export async function getPolicyScope(): Promise<PolicyEmbedClaims | null> {
  const jar = await cookies();
  const claims = await verifyPolicyEmbedToken(
    jar.get(POLICY_SCOPE_COOKIE)?.value,
  );
  if (!claims) return null;

  if (claims.mode === "position") {
    const resolved = await resolveJobPositionRef(
      claims.positionId,
      claims.positionName,
    );
    if (!resolved) return claims;
    return {
      ...claims,
      positionId: resolved.id,
      positionName: resolved.name,
    };
  }

  return claims;
}

export async function requirePolicyMutation() {
  const scope = await getPolicyScope();
  if (isRestrictedScope(scope)) {
    return {
      error: Response.json(
        {
          ok: false,
          error:
            "Таны эрхэд журам/үнэлгээ засах боломжгүй. Зөвхөн өөрийн нэгжийн мэдээллийг харна.",
        },
        { status: 403 },
      ),
    };
  }
  return { scope };
}

/** Destructive store ops — Admin role only (or local/dev with no embed scope). */
export async function assertPolicyAdminAccess() {
  const scope = await getPolicyScope();
  if (isRestrictedScope(scope)) {
    throw new Error(
      "Нэгж / ажлын байрны эрхээр өгөгдөл устгах боломжгүй.",
    );
  }
  if (scope && scope.role !== "admin") {
    throw new Error(
      "Зөвхөн Admin эрхтэй хэрэглэгч өгөгдлийн цэвэрлэгээ хийх боломжтой.",
    );
  }
  return scope;
}

export function isPolicyAdmin(scope: PolicyEmbedClaims | null | undefined) {
  if (isRestrictedScope(scope)) return false;
  if (!scope) return true;
  return scope.role === "admin";
}

export function positionHomePath(scope: PolicyEmbedClaims | null) {
  if (isPositionScoped(scope) && scope?.positionId) {
    return `/positions/${scope.positionId}`;
  }
  if (scope?.mode === "unit") {
    if (scope.heltesId && scope.albaId) {
      return `/org/heltes/${scope.heltesId}/alba/${scope.albaId}`;
    }
    if (scope.heltesId) return `/org/heltes/${scope.heltesId}`;
    return "/org";
  }
  return "/my";
}
