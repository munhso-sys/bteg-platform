"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCw, Save } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { SettingsAdminRedirect } from "@/components/settings/SettingsAdminRedirect";
import type { ModuleMenuCatalogEntry } from "@/lib/rbac/module-menus";
import type {
  ModuleMenuSelection,
  RoleMenuVisibilityStore,
} from "@/lib/rbac/role-menu-visibility";

type Role = { id: string; label: string; description: string | null; sort_order: number };
type Permission = {
  id: string;
  label: string;
  module: string;
  description: string | null;
};

const MODULE_LABELS: Record<string, string> = {
  portal: "Портал",
  "policy-compliance": "Журмын биелэлт",
  inspection: "Хяналт шалгалт",
  development: "Судалгаа хөгжүүлэлт",
  guidance: "Удирдамж",
  voice: "Ажилтны дуу хоолой",
  ai: "AI туслах",
  review: "Баримт харьцуулалт",
  glossary: "Толь бичиг",
  result: "Үр дүн",
  smartmine: "SmartMine",
  tools: "Tools",
  process: "Процесс",
};

function emptySelection(): ModuleMenuSelection {
  return { menuIds: [], submenuIds: {} };
}

export default function RolePermissionsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [matrix, setMatrix] = useState<Record<string, string[]>>({});
  const [baseId, setBaseId] = useState("module.policy.view");
  const [roleId, setRoleId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMsg, setSavedMsg] = useState("");

  const [menuCatalog, setMenuCatalog] = useState<ModuleMenuCatalogEntry[]>([]);
  const [menuStore, setMenuStore] = useState<RoleMenuVisibilityStore>({});
  const [menuModuleId, setMenuModuleId] = useState("");
  const [menuSelection, setMenuSelection] =
    useState<ModuleMenuSelection>(emptySelection());
  const [savingMenus, setSavingMenus] = useState(false);
  const [menuSavedMsg, setMenuSavedMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setSavedMsg("");
    setMenuSavedMsg("");
    try {
      const [permRes, menuRes] = await Promise.all([
        fetch("/api/admin/role-permissions", { cache: "no-store" }),
        fetch("/api/admin/role-menus", { cache: "no-store" }),
      ]);
      const data = await permRes.json();
      if (!permRes.ok || !data.ok) {
        setError(data.error || "Ачаалахад алдаа");
        return;
      }
      const nextRoles = (data.roles ?? []) as Role[];
      setRoles(nextRoles);
      setPermissions(data.permissions ?? []);
      setMatrix(data.matrix ?? {});
      setBaseId(data.base_permission_id ?? "module.policy.view");
      setRoleId((prev) => prev || nextRoles[0]?.id || "");

      const menus = await menuRes.json();
      if (menuRes.ok && menus.ok) {
        const catalog = (menus.catalog ?? []) as ModuleMenuCatalogEntry[];
        setMenuCatalog(catalog);
        setMenuStore(menus.store ?? {});
        setMenuModuleId((prev) => prev || catalog[0]?.moduleId || "");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  useEffect(() => {
    if (!roleId) return;
    const ids = matrix[roleId] ?? [];
    const timer = window.setTimeout(() => {
      setSelected(new Set(ids));
      setSavedMsg("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [roleId, matrix]);

  useEffect(() => {
    if (!roleId || !menuModuleId) return;
    const existing = menuStore[roleId]?.[menuModuleId];
    const catalog = menuCatalog.find((m) => m.moduleId === menuModuleId);
    const timer = window.setTimeout(() => {
      if (existing) {
        setMenuSelection({
          ...existing,
          submenuIds: { ...existing.submenuIds },
        });
      } else if (catalog) {
        // Unconfigured = all menus visible; pre-select all so accidental save keeps them.
        setMenuSelection({
          menuIds: catalog.menus.map((m) => m.id),
          submenuIds: Object.fromEntries(
            catalog.menus
              .filter((m) => m.children?.length)
              .map((m) => [m.id, (m.children ?? []).map((c) => c.id)]),
          ),
        });
      } else {
        setMenuSelection(emptySelection());
      }
      setMenuSavedMsg("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [roleId, menuModuleId, menuStore, menuCatalog]);

  const grouped = useMemo(() => {
    const map = new Map<string, Permission[]>();
    for (const p of permissions) {
      const list = map.get(p.module) ?? [];
      list.push(p);
      map.set(p.module, list);
    }
    return Array.from(map.entries());
  }, [permissions]);

  const activeRole = roles.find((r) => r.id === roleId);
  const activeMenuModule = menuCatalog.find((m) => m.moduleId === menuModuleId);

  function toggle(permId: string) {
    if (permId === baseId) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
    setSavedMsg("");
  }

  function toggleMenu(menuId: string) {
    const catalogMenus =
      menuCatalog.find((m) => m.moduleId === menuModuleId)?.menus ?? [];
    const menuDef = catalogMenus.find((m) => m.id === menuId);
    const allChildren = (menuDef?.children ?? []).map((c) => c.id);

    setMenuSelection((prev) => {
      const has = prev.menuIds.includes(menuId);
      const menuIds = has
        ? prev.menuIds.filter((id) => id !== menuId)
        : [...prev.menuIds, menuId];
      const submenuIds = { ...prev.submenuIds };
      if (has) {
        delete submenuIds[menuId];
      } else if (allChildren.length > 0) {
        // Parent ON → start with all дэд цэс checked; user can uncheck.
        submenuIds[menuId] = allChildren;
      }
      return { menuIds, submenuIds };
    });
    setMenuSavedMsg("");
  }

  function toggleSubmenu(parentId: string, childId: string) {
    setMenuSelection((prev) => {
      const current = prev.submenuIds[parentId] ?? [];
      const has = current.includes(childId);
      const nextKids = has
        ? current.filter((id) => id !== childId)
        : [...current, childId];
      return {
        ...prev,
        // Ensure parent stays selected while editing children.
        menuIds: prev.menuIds.includes(parentId)
          ? prev.menuIds
          : [...prev.menuIds, parentId],
        submenuIds: { ...prev.submenuIds, [parentId]: nextKids },
      };
    });
    setMenuSavedMsg("");
  }

  async function save() {
    if (!roleId) return;
    setSaving(true);
    setError("");
    setSavedMsg("");
    try {
      const res = await fetch("/api/admin/role-permissions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_id: roleId,
          permission_ids: Array.from(selected),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Хадгалахад алдаа");
        return;
      }
      setMatrix((prev) => ({
        ...prev,
        [roleId]: data.permission_ids ?? Array.from(selected),
      }));
      setSavedMsg("Хадгаллаа");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа");
    } finally {
      setSaving(false);
    }
  }

  async function saveMenus() {
    if (!roleId || !menuModuleId) return;
    setSavingMenus(true);
    setError("");
    setMenuSavedMsg("");
    try {
      const res = await fetch("/api/admin/role-menus", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role_id: roleId,
          module_id: menuModuleId,
          selection: menuSelection,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Цэс хадгалахад алдаа");
        return;
      }
      setMenuStore(data.store ?? {});
      setMenuSavedMsg("Цэсийн харагдах байдал хадгаллаа");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа");
    } finally {
      setSavingMenus(false);
    }
  }

  return (
    <div>
      <SettingsAdminRedirect />
      <PageHeader
        title="Role эрхийн тохиргоо"
        description="Үндсэн эрх: холбогдох журмын заалт харах. Нэмэлт эрх болон модулийн sidebar цэсийг role тус бүрээр сонгоно."
        actions={
          <button type="button" className="btn btn-ghost" onClick={() => void load()}>
            <RefreshCw size={14} /> Шинэчлэх
          </button>
        }
      />
      <SettingsNav />

      <div className="mb-4 rounded-md border border-[var(--border)] bg-white p-3 text-sm text-[var(--muted)]">
        Бүх role дээр <strong className="text-[var(--fg)]">Журмын биелэлт · харах</strong> үндсэн
        эрхээр үлдэнэ. Доорх нэмэлт эрхүүдийг сонгож хадгална. «Хяналт засах»-ийг хассан
        role зөвхөн харах горимд ХШ нээнэ (засах API хаагдана).
      </div>

      {error ? (
        <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <Loader2 size={16} className="animate-spin" /> Ачаалж байна…
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <aside className="rounded-md border border-[var(--border)] bg-white">
            <div className="border-b border-[var(--border)] px-3 py-2 text-sm font-semibold">
              Role
            </div>
            <div className="max-h-[28rem] overflow-y-auto p-1">
              {roles.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRoleId(r.id)}
                  className={`mb-0.5 w-full rounded-md px-3 py-2 text-left text-sm ${
                    roleId === r.id
                      ? "bg-[var(--brand)] text-white"
                      : "hover:bg-slate-50 text-[var(--fg)]"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </aside>

          <div className="grid min-w-0 gap-4 xl:grid-cols-2 xl:items-start">
            <section className="flex min-h-0 min-w-0 flex-col rounded-md border border-[var(--border)] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
                <div>
                  <div className="text-sm font-semibold">
                    {activeRole?.label ?? "Role сонгоно уу"} · эрх
                  </div>
                  {activeRole?.description ? (
                    <div className="text-xs text-[var(--muted)]">{activeRole.description}</div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  {savedMsg ? (
                    <span className="text-xs text-emerald-700">{savedMsg}</span>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!roleId || saving}
                    onClick={() => void save()}
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    Эрх хадгалах
                  </button>
                </div>
              </div>

              <div className="max-h-[calc(100vh-16rem)] space-y-5 overflow-y-auto p-4">
                {grouped.map(([module, perms]) => (
                  <div key={module}>
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--brand)]">
                      {MODULE_LABELS[module] ?? module}
                    </div>
                    <div className="space-y-2">
                      {perms.map((perm) => {
                        const locked = perm.id === baseId;
                        const checked = locked || selected.has(perm.id);
                        return (
                          <label
                            key={perm.id}
                            className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 text-sm ${
                              checked
                                ? "border-amber-200 bg-amber-50/60"
                                : "border-[var(--border)] bg-white"
                            } ${locked ? "opacity-90" : ""}`}
                          >
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={checked}
                              disabled={locked}
                              onChange={() => toggle(perm.id)}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="font-medium text-[var(--fg)]">
                                {perm.label}
                                {locked ? (
                                  <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                                    үндсэн
                                  </span>
                                ) : null}
                              </span>
                              {perm.description ? (
                                <span className="mt-0.5 block text-xs text-[var(--muted)]">
                                  {perm.description}
                                </span>
                              ) : null}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="flex min-h-0 min-w-0 flex-col rounded-md border border-[var(--border)] bg-white">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] px-3 py-2">
                <div>
                  <div className="text-sm font-semibold">Модулийн sidebar цэс</div>
                  <div className="text-xs text-[var(--muted)]">
                    Модуль сонгоод харагдах цэс/дэд цэсийг сонгоно. Журмууд, Ажлын байр дээр Удирдлага /
                    Шалгах дэд цэсийг select box-оор сонгоно.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {menuSavedMsg ? (
                    <span className="text-xs text-emerald-700">{menuSavedMsg}</span>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!roleId || !menuModuleId || savingMenus}
                    onClick={() => void saveMenus()}
                  >
                    {savingMenus ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Save size={14} />
                    )}
                    Цэс хадгалах
                  </button>
                </div>
              </div>

              <div className="max-h-[calc(100vh-16rem)] space-y-4 overflow-y-auto p-4">
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-[var(--fg)]">Модуль</span>
                  <select
                    className="w-full rounded-md border border-[var(--border)] bg-white px-3 py-2 text-sm"
                    value={menuModuleId}
                    onChange={(e) => setMenuModuleId(e.target.value)}
                  >
                    {menuCatalog.map((m) => (
                      <option key={m.moduleId} value={m.moduleId}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>

                {activeMenuModule ? (
                  <div className="space-y-3">
                    <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--brand)]">
                      {activeMenuModule.label} · харагдах цэс
                    </div>
                    <div className="space-y-3">
                      {activeMenuModule.menus.map((menu) => {
                        const checked = menuSelection.menuIds.includes(menu.id);
                        const childIds = menu.children?.map((c) => c.id) ?? [];
                        const selectedChildren = menuSelection.submenuIds[menu.id] ?? [];
                        return (
                          <div
                            key={menu.id}
                            className={`rounded-md border px-3 py-2.5 ${
                              checked
                                ? "border-amber-200 bg-amber-50/60"
                                : "border-[var(--border)] bg-white"
                            }`}
                          >
                            <label className="flex cursor-pointer items-start gap-3 text-sm">
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={checked}
                                onChange={() => toggleMenu(menu.id)}
                              />
                              <span className="font-medium text-[var(--fg)]">{menu.label}</span>
                            </label>
                            {checked && menu.children && menu.children.length > 0 ? (
                              <div className="mt-2 space-y-1.5 border-l-2 border-amber-200/80 pl-4 ml-2">
                                <div className="text-xs font-medium text-[var(--muted)]">
                                  Дэд цэс — {menu.label}
                                  {childIds.length
                                    ? ` (${selectedChildren.length}/${childIds.length})`
                                    : ""}
                                </div>
                                {menu.children.map((child) => {
                                  const childChecked =
                                    selectedChildren.includes(child.id);
                                  return (
                                    <label
                                      key={child.id}
                                      className={`flex cursor-pointer items-center gap-2.5 rounded-md border px-2.5 py-2 text-sm ${
                                        childChecked
                                          ? "border-amber-200 bg-white"
                                          : "border-[var(--border)] bg-slate-50/80"
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={childChecked}
                                        onChange={() =>
                                          toggleSubmenu(menu.id, child.id)
                                        }
                                      />
                                      <span className="font-medium text-[var(--fg)]">
                                        {child.label}
                                      </span>
                                    </label>
                                  );
                                })}
                                <p className="text-[11px] text-[var(--muted)]">
                                  Жишээ: зөвхөн «Шалгах» харуулах бол «Удирдлага»-г хасаад
                                  «Цэс хадгалах».
                                </p>
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[var(--muted)]">Модулийн цэсийн жагсаалт алга.</p>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
