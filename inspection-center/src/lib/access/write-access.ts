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
 * Explicit local/QA escape hatch only.
 * Never set in Preview/Production.
 */
export function allowUnscopedInspectionWrites(): boolean {
  return process.env.INSPECTION_ALLOW_UNSCOPED_WRITES?.trim() === "1";
}

/**
 * IC-D05: fail closed — missing/invalid embed must not grant write.
 * Unit mode remains read-only. Signed `mode: "full"` (or non-unit) may write.
 */
export function decideInspectionWriteAccess(
  scope: InspectionEmbedClaims | null | undefined,
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
    if (allowUnscopedInspectionWrites()) {
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
 * Null scope is not admin (IC-D05 fail-closed), unless explicit local escape.
 */
export function decideInspectionAdminAccess(
  scope: InspectionEmbedClaims | null | undefined,
): InspectionWriteDecision {
  const write = decideInspectionWriteAccess(scope);
  if (!write.allow) return write;

  if (!scope) {
    // Only reachable with INSPECTION_ALLOW_UNSCOPED_WRITES=1
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
): boolean {
  if (isUnitScopedInspection(scope)) return false;
  if (!scope) return allowUnscopedInspectionWrites();
  return scope.role === "admin";
}
