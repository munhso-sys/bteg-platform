"use client";

import { createContext, useContext, useMemo } from "react";
import {
  canAccessPolicyPath,
  isPathAllowedByMenuSelection,
  resolvePolicyMenuPath,
} from "@/lib/access/menu-route-guard";

export { canAccessPolicyPath };

export type PolicyNavFilter = {
  /** null = show all top-level menus */
  menus: string[] | null;
  /** null/missing parent = show all children for that parent */
  submenus: Record<string, string[]> | null;
};

const PolicyNavContext = createContext<PolicyNavFilter>({
  menus: null,
  submenus: null,
});

export function PolicyNavProvider({
  value,
  children,
}: {
  value: PolicyNavFilter;
  children: React.ReactNode;
}) {
  return (
    <PolicyNavContext.Provider value={value}>
      {children}
    </PolicyNavContext.Provider>
  );
}

export function usePolicyNavFilter() {
  return useContext(PolicyNavContext);
}

/** Client-side path allow check matching middleware menu-route-guard. */
export function useCanAccessPolicyPath(pathname: string): boolean {
  const { menus, submenus } = usePolicyNavFilter();
  return useMemo(
    () =>
      isPathAllowedByMenuSelection(
        pathname,
        { menuIds: menus, submenuIds: submenus },
        resolvePolicyMenuPath,
        // UI filter only: never depend on server-only NAV_G1_ENFORCE (hydration).
        { g1: false },
      ),
    [pathname, menus, submenus],
  );
}

export function filterPolicyMenus<
  T extends { href: string; children?: { href: string; label: string }[] },
>(
  items: T[],
  menus: string[] | null | undefined,
  submenus: Record<string, string[]> | null | undefined,
): T[] {
  let list = items;
  if (menus) {
    const allow = new Set(menus);
    list = list.filter((item) => allow.has(item.href));
  }

  return list
    .map((item) => {
      if (!item.children?.length) return item;
      if (
        !submenus ||
        !Object.prototype.hasOwnProperty.call(submenus, item.href)
      ) {
        return item;
      }
      const allowKids = new Set(submenus[item.href] ?? []);
      const children = item.children.filter((c) => allowKids.has(c.href));
      if (children.length === 0) return null;
      const href = allowKids.has(item.href) ? item.href : children[0]!.href;
      return { ...item, href, children };
    })
    .filter((item): item is T => item != null);
}

export function filterPolicySubnav<T extends { href: string }>(
  items: readonly T[] | T[],
  parentHref: string,
  submenus: Record<string, string[]> | null | undefined,
): T[] {
  if (
    !submenus ||
    !Object.prototype.hasOwnProperty.call(submenus, parentHref)
  ) {
    return [...items];
  }
  const allow = new Set(submenus[parentHref] ?? []);
  return items.filter((item) => allow.has(item.href));
}
