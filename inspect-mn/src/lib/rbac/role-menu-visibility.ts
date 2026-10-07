/**
 * Role → module → visible sidebar menus/submenus.
 * Stored in app_data_store (no new table). Missing module key = show all (compat).
 */

export const ROLE_MENU_VISIBILITY_KEY = "role_menu_visibility";

export type ModuleMenuSelection = {
  /** Selected top-level sidebar menu ids for the module. */
  menuIds: string[];
  /** Selected submenu ids keyed by parent menu id. */
  submenuIds: Record<string, string[]>;
};

/** roleId → moduleId → selection */
export type RoleMenuVisibilityStore = Record<
  string,
  Record<string, ModuleMenuSelection>
>;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function normalizeRoleMenuVisibilityStore(
  raw: unknown,
): RoleMenuVisibilityStore {
  if (!isRecord(raw)) return {};
  const out: RoleMenuVisibilityStore = {};
  for (const [roleId, roleVal] of Object.entries(raw)) {
    if (!isRecord(roleVal)) continue;
    const roleOut: Record<string, ModuleMenuSelection> = {};
    for (const [moduleId, modVal] of Object.entries(roleVal)) {
      if (!isRecord(modVal)) continue;
      const menuIds = Array.isArray(modVal.menuIds)
        ? modVal.menuIds.filter((x): x is string => typeof x === "string")
        : [];
      const submenuIds: Record<string, string[]> = {};
      if (isRecord(modVal.submenuIds)) {
        for (const [parent, kids] of Object.entries(modVal.submenuIds)) {
          if (!Array.isArray(kids)) continue;
          submenuIds[parent] = kids.filter(
            (x): x is string => typeof x === "string",
          );
        }
      }
      roleOut[moduleId] = { menuIds, submenuIds };
    }
    out[roleId] = roleOut;
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadRoleMenuVisibilityStore(
  db: any,
): Promise<RoleMenuVisibilityStore> {
  const { data, error } = await db
    .from("app_data_store")
    .select("payload")
    .eq("key", ROLE_MENU_VISIBILITY_KEY)
    .maybeSingle();
  if (error) {
    console.error("[role-menu-visibility] load failed", error.message);
    return {};
  }
  return normalizeRoleMenuVisibilityStore(data?.payload);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function saveRoleMenuVisibilityStore(
  db: any,
  store: RoleMenuVisibilityStore,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await db.from("app_data_store").upsert({
    key: ROLE_MENU_VISIBILITY_KEY,
    payload: store,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function loadRoleModuleMenuConfig(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  roleId: string | null,
  moduleId: string,
): Promise<ModuleMenuSelection | null> {
  if (!roleId) return null;
  const store = await loadRoleMenuVisibilityStore(db);
  return store[roleId]?.[moduleId] ?? null;
}
