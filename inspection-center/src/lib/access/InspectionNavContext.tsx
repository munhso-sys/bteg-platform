"use client";

import { createContext, useContext } from "react";

export type InspectionNavFilter = {
  /** null = show all top-level menus */
  menus: string[] | null;
  /** null/missing parent = show all children for that parent */
  submenus: Record<string, string[]> | null;
};

const InspectionNavContext = createContext<InspectionNavFilter>({
  menus: null,
  submenus: null,
});

export function InspectionNavProvider({
  value,
  children,
}: {
  value: InspectionNavFilter;
  children: React.ReactNode;
}) {
  return (
    <InspectionNavContext.Provider value={value}>
      {children}
    </InspectionNavContext.Provider>
  );
}

export function useInspectionNavFilter() {
  return useContext(InspectionNavContext);
}

export function filterMenusByAllowlist<T extends { href: string }>(
  items: readonly T[] | T[],
  allow: string[] | null | undefined,
): T[] {
  if (!allow) return [...items];
  const set = new Set(allow);
  return items.filter((item) => set.has(item.href));
}

export function filterSubnavByAllowlist<T extends { href: string }>(
  items: readonly T[] | T[],
  parentHref: string,
  submenus: Record<string, string[]> | null | undefined,
): T[] {
  if (!submenus || !Object.prototype.hasOwnProperty.call(submenus, parentHref)) {
    return [...items];
  }
  const allow = submenus[parentHref] ?? [];
  const set = new Set(allow);
  return items.filter((item) => set.has(item.href));
}
