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
 * Legacy bypass env names are recognized only so tests can prove they are ignored.
 * Unscoped writes are permanently disabled (IC-D05 hardening).
 */
export function allowUnscopedInspectionWrites(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  void env;
  return false;
}

/**
 * IC-D05: fail closed — missing/invalid embed must not grant write.
 * Unit mode remains read-only. Signed non-unit scope may write.
 */
export function decideInspectionWriteAccess(
  scope: InspectionEmbedClaims | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): InspectionWriteDecision {
  void env;
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
 * Null scope is never admin.
 */
export function decideInspectionAdminAccess(
  scope: InspectionEmbedClaims | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): InspectionWriteDecision {
  const write = decideInspectionWriteAccess(scope, env);
  if (!write.allow) return write;

  if (!scope || scope.role !== "admin") {
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
  void env;
  if (isUnitScopedInspection(scope)) return false;
  if (!scope) return false;
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
