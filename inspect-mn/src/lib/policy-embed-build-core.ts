import type { PolicyEmbedMode } from "@/lib/policy-embed";

export const POLICY_EMBED_BUILD_TIMEOUT_MS = 4_000;

export async function withTimeout<T>(
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

export type PolicyEmbedModeInput = {
  canEdit: boolean;
  isUnitScoped: boolean;
  unitActive: boolean;
  isPositionScoped: boolean;
  hasRoleMenus: boolean;
};

/**
 * Navigation (Role эрх menus) controls surface reachability.
 * Permission controls edit/write. Missing edit ≠ force workplace /my.
 */
export function choosePolicyEmbedMode(
  input: PolicyEmbedModeInput,
): PolicyEmbedMode {
  if (input.canEdit) return "full";
  if (input.isUnitScoped && input.unitActive) return "unit";
  if (input.isPositionScoped && !input.hasRoleMenus) return "position";
  return "view";
}

export function choosePolicyEntryPath(input: {
  mode: PolicyEmbedMode;
  positionId: string | null;
  unit: {
    heltesId: string | null;
    albaId: string | null;
  };
  menus: string[] | null;
  submenus: Record<string, string[]> | null;
}): string {
  const { mode, positionId, unit, menus, submenus } = input;
  if (mode === "position") {
    return positionId ? `/positions/${positionId}` : "/my";
  }
  if (mode === "unit") {
    if (unit.heltesId && unit.albaId) {
      return `/org/heltes/${unit.heltesId}/alba/${unit.albaId}`;
    }
    if (unit.heltesId) return `/org/heltes/${unit.heltesId}`;
    return "/org";
  }
  if (menus && menus.length > 0) {
    let entryPath = menus.includes("/dashboard") ? "/dashboard" : menus[0]!;
    if (
      entryPath === "/policies" &&
      submenus?.["/policies"]?.includes("/policies/review") &&
      !submenus["/policies"].includes("/policies")
    ) {
      entryPath = "/policies/review";
    }
    if (
      entryPath === "/positions" &&
      submenus?.["/positions"]?.includes("/positions/review") &&
      !submenus["/positions"].includes("/positions")
    ) {
      entryPath = "/positions/review";
    }
    return entryPath;
  }
  return "/dashboard";
}

export type PolicyEmbedTiming = {
  profileMs: number;
  permissionsMs: number;
  menuConfigMs: number;
  resolveMs: number;
  signMs: number;
  totalMs: number;
};

export function emptyTiming(): PolicyEmbedTiming {
  return {
    profileMs: 0,
    permissionsMs: 0,
    menuConfigMs: 0,
    resolveMs: 0,
    signMs: 0,
    totalMs: 0,
  };
}

export function logPolicyEmbedTiming(
  label: string,
  timing: PolicyEmbedTiming,
  meta: Record<string, string | number | boolean | null | undefined>,
) {
  if (process.env.POLICY_EMBED_TIMING !== "1") return;
  console.info(
    JSON.stringify({
      event: "policy_embed_timing",
      label,
      ...timing,
      ...meta,
    }),
  );
}
