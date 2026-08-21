import type { RoleId, UserProfile } from "@/lib/rbac/types";
import {
  normalizeUnitLabel,
  type UnitScope,
} from "@/lib/rbac/unit-scope";
import {
  enabledAiSources,
  type AiDataSource,
  type AiScopeConfig,
  type AiScopeMode,
} from "@/lib/ai/scope-config";

export type AiResolvedScope = {
  mode: AiScopeMode;
  unitScope: UnitScope;
  sources: AiDataSource[];
  roleId: RoleId | null;
  scopeNote: string;
};

function buildUnitScopeFromProfile(
  profile: Pick<
    UserProfile,
    "heltes_id" | "heltes_name" | "alba_id" | "alba_name"
  > | null,
): UnitScope {
  const heltesId = profile?.heltes_id?.trim() || null;
  const albaId = profile?.alba_id?.trim() || null;
  const heltesName = profile?.heltes_name?.trim() || null;
  const albaName = profile?.alba_name?.trim() || null;
  const labels = [...new Set([albaName, heltesName].map(normalizeUnitLabel).filter(Boolean))];
  return {
    active: Boolean(heltesId || albaId || labels.length),
    heltesId,
    albaId,
    heltesName,
    albaName,
    labels,
  };
}

/**
 * Resolve AI data visibility for the signed-in user.
 * Admin (and other fullAccessRoles) → platform-wide.
 * Other roles → only their heltes/alba when assigned; otherwise no unit-bound facts.
 */
export function resolveAiDataScope(
  profile: UserProfile | null,
  roleId: RoleId | null,
  config: AiScopeConfig,
): AiResolvedScope {
  const role = (roleId ?? profile?.role_id ?? null) as RoleId | null;
  const sources = enabledAiSources(config);
  const emptyUnit: UnitScope = {
    active: false,
    heltesId: null,
    albaId: null,
    heltesName: null,
    albaName: null,
    labels: [],
  };

  if (role && config.fullAccessRoles.includes(role)) {
    return {
      mode: "all",
      unitScope: emptyUnit,
      sources,
      roleId: role,
      scopeNote: "Бүх алба/хэлтэсийн платформын мэдээлэл",
    };
  }

  const unit = buildUnitScopeFromProfile(profile);
  const forceUnit =
    !role ||
    config.unitScopedRoles.includes(role) ||
    !config.fullAccessRoles.includes(role);

  if (forceUnit && unit.active) {
    const where = [unit.heltesName, unit.albaName].filter(Boolean).join(" · ");
    return {
      mode: "unit",
      unitScope: { ...unit, active: true },
      sources,
      roleId: role,
      scopeNote: `Зөвхөн өөрийн нэгж (${where || "хэлтэс/алба"})`,
    };
  }

  return {
    mode: "none",
    unitScope: emptyUnit,
    sources,
    roleId: role,
    scopeNote:
      "Хэлтэс/алба оноолгоогүй тул нэгжийн мэдээлэл харагдахгүй. Профайлд алба/хэлтэс оноолгоо хийлгэнэ үү.",
  };
}
