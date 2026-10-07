import { NextResponse } from "next/server";
import { requireAdminContext } from "@/lib/rbac/require-admin";
import {
  MODULE_MENU_CATALOG,
  NAV_MENU_CATALOG_VERSION,
} from "@/lib/rbac/module-menus";
import {
  loadRoleMenuVisibilityStore,
  normalizeRoleMenuVisibilityStore,
  saveRoleMenuVisibilityStore,
  type ModuleMenuSelection,
  type RoleMenuVisibilityStore,
} from "@/lib/rbac/role-menu-visibility";

export async function GET() {
  const ctx = await requireAdminContext();
  if ("error" in ctx) return ctx.error;

  const store = await loadRoleMenuVisibilityStore(ctx.admin);
  return NextResponse.json({
    ok: true,
    catalogVersion: NAV_MENU_CATALOG_VERSION,
    catalog: MODULE_MENU_CATALOG,
    store,
  });
}

export async function PUT(req: Request) {
  const ctx = await requireAdminContext();
  if ("error" in ctx) return ctx.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "JSON буруу" }, { status: 400 });
  }

  const roleId =
    typeof (body as { role_id?: unknown })?.role_id === "string"
      ? (body as { role_id: string }).role_id.trim()
      : "";
  const moduleId =
    typeof (body as { module_id?: unknown })?.module_id === "string"
      ? (body as { module_id: string }).module_id.trim()
      : "";

  if (!roleId || !moduleId) {
    return NextResponse.json(
      { ok: false, error: "role_id болон module_id шаардлагатай" },
      { status: 400 },
    );
  }

  if (!MODULE_MENU_CATALOG.some((m) => m.moduleId === moduleId)) {
    return NextResponse.json(
      { ok: false, error: "Үл мэдэгдэх модуль" },
      { status: 400 },
    );
  }

  const selectionRaw = (body as { selection?: unknown })?.selection;
  const normalized = normalizeRoleMenuVisibilityStore({
    [roleId]: { [moduleId]: selectionRaw },
  });
  const selection: ModuleMenuSelection = normalized[roleId]?.[moduleId] ?? {
    menuIds: [],
    submenuIds: {},
  };

  const store = await loadRoleMenuVisibilityStore(ctx.admin);
  const next: RoleMenuVisibilityStore = {
    ...store,
    [roleId]: {
      ...(store[roleId] ?? {}),
      [moduleId]: selection,
    },
  };

  const saved = await saveRoleMenuVisibilityStore(ctx.admin, next);
  if (!saved.ok) {
    return NextResponse.json({ ok: false, error: saved.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    catalogVersion: NAV_MENU_CATALOG_VERSION,
    role_id: roleId,
    module_id: moduleId,
    selection,
    store: next,
  });
}
