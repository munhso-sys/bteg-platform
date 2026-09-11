import {
  isUnitScopedInspection,
  type InspectionEmbedClaims,
} from "@/lib/access/embed";

export type InspectionWriteDenyReason =
  | "missing_scope"
  | "unit_readonly"
  | "not_admin";

export type InspectionWriteDecision =
  | { allow: true }
  | {
      allow: false;
      reason: InspectionWriteDenyReason;
      status: 401 | 403;
      message: string;
    };

/**
 * Hosted / production-like runtimes must never honor local-only escapes.
 */
export function isHostedOrProductionRuntime(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (env.NODE_ENV === "production") return true;
  if (env.VERCEL === "1") return true;
  if (env.VERCEL_ENV === "preview" || env.VERCEL_ENV === "production") {
    return true;
  }
  return false;
}

/**
 * Local-only escape for `next dev` (and optional explicit flags).
 * Never honored on Vercel / NODE_ENV=production (IC-D05).
 */
export function allowUnscopedInspectionWrites(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (isHostedOrProductionRuntime(env)) return false;
  if (env.NODE_ENV === "development") return true;
  return (
    env.INSPECTION_ALLOW_UNSCOPED_WRITES?.trim() === "1" ||
    env.INSPECTION_DEV_ALLOW_UNSCOPED_WRITES?.trim() === "1"
  );
}

/**
 * IC-D05: fail closed on hosted runtimes — missing/invalid embed must not grant write.
 * Unit mode remains read-only. Signed non-unit scope may write.
 * Local `next dev` allows unscoped writes for offline QA.
 */
export function decideInspectionWriteAccess(
  scope: InspectionEmbedClaims | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): InspectionWriteDecision {
  if (isUnitScopedInspection(scope)) {
    return {
      allow: false,
      reason: "unit_readonly",
      status: 403,
      message:
        "Нэгжийн удирдлага / Ахлах мэргэжилтэн зөвхөн харах эрхтэй. Засах боломжгүй.",
    };
  }

  if (!scope) {
    if (allowUnscopedInspectionWrites(env)) {
      return { allow: true };
    }
    return {
      allow: false,
      reason: "missing_scope",
      status: 401,
      message: "Хандалтын эрх баталгаажаагүй байна. Portal embed шаардлагатай.",
    };
  }

  return { allow: true };
}

/**
 * Admin destructive ops: require signed scope with role admin.
 * Local unscoped escape (next dev only) may act as admin for data tools.
 */
export function decideInspectionAdminAccess(
  scope: InspectionEmbedClaims | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): InspectionWriteDecision {
  const write = decideInspectionWriteAccess(scope, env);
  if (!write.allow) return write;

  if (!scope) {
    // Only reachable via local unscoped escape
    return { allow: true };
  }

  if (scope.role !== "admin") {
    return {
      allow: false,
      reason: "not_admin",
      status: 403,
      message:
        "Зөвхөн Admin эрхтэй хэрэглэгч өгөгдлийн цэвэрлэгээ хийх боломжтой.",
    };
  }

  return { allow: true };
}

export function isInspectionAdminScope(
  scope: InspectionEmbedClaims | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (isUnitScopedInspection(scope)) return false;
  if (!scope) return allowUnscopedInspectionWrites(env);
  return scope.role === "admin";
}

/** Mutations succeed only when the expected row count was affected. */
export function mutationAffectedRows(
  affected: number | null | undefined,
): { ok: true; affected: number } | { ok: false; reason: "zero_rows" | "unknown" } {
  if (affected == null || Number.isNaN(affected)) {
    return { ok: false, reason: "unknown" };
  }
  if (affected <= 0) return { ok: false, reason: "zero_rows" };
  return { ok: true, affected };
}

/** Scope/auth resolution errors must deny, never allow. */
export function denyOnScopeResolutionError(
  error: unknown,
): InspectionWriteDecision {
  void error;
  return {
    allow: false,
    reason: "missing_scope",
    status: 401,
    message: "Хандалтын эрх баталгаажаагүй байна. Portal embed шаардлагатай.",
  };
}
