import {
  UNIT_FINDINGS_ROLES,
  type RoleId,
  type UserProfile,
} from "@/lib/rbac/types";

export type UnitScope = {
  /** True only for unit_manager / senior_specialist with org assignment */
  active: boolean;
  heltesId: string | null;
  albaId: string | null;
  heltesName: string | null;
  albaName: string | null;
  /** Normalized labels for free-text matching (department / unit fields) */
  labels: string[];
};

export function normalizeUnitLabel(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[[\]]/g, "")
    .replace(/[·•]/g, " ")
    .replace(/[_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveUnitScope(
  profile: Pick<
    UserProfile,
    "heltes_id" | "heltes_name" | "alba_id" | "alba_name" | "role_id"
  > | null,
  roleId?: RoleId | null,
): UnitScope {
  const role = (roleId ?? profile?.role_id ?? null) as RoleId | null;
  const empty: UnitScope = {
    active: false,
    heltesId: null,
    albaId: null,
    heltesName: null,
    albaName: null,
    labels: [],
  };
  if (!role || !UNIT_FINDINGS_ROLES.includes(role)) return empty;

  const heltesId = profile?.heltes_id?.trim() || null;
  const albaId = profile?.alba_id?.trim() || null;
  const heltesName = profile?.heltes_name?.trim() || null;
  const albaName = profile?.alba_name?.trim() || null;
  const labels = [albaName, heltesName]
    .map(normalizeUnitLabel)
    .filter(Boolean);
  // Deduplicate
  const unique = [...new Set(labels)];

  return {
    active: Boolean(heltesId || albaId || unique.length),
    heltesId,
    albaId,
    heltesName,
    albaName,
    labels: unique,
  };
}

export function matchesUnitText(
  value: string | null | undefined,
  scope: UnitScope,
): boolean {
  if (!scope.active) return true;
  if (!scope.labels.length) return false;
  const n = normalizeUnitLabel(value);
  if (!n) return false;
  return scope.labels.some((label) => n.includes(label) || label.includes(n));
}

export function isUnitScopedRole(roleId: string | null | undefined) {
  return Boolean(
    roleId && UNIT_FINDINGS_ROLES.includes(roleId as RoleId),
  );
}
