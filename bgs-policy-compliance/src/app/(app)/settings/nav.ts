export const SETTINGS_NAV = [
  { href: "/settings", label: "Ерөнхий", exact: true },
  { href: "/settings/org-structure", label: "Байгууллага · нэгж" },
  { href: "/settings/org-policies", label: "Алба · журам холбох" },
  { href: "/settings/data", label: "Өгөгдөл", adminOnly: true },
] as const;

export function isSettingsNavActive(
  pathname: string,
  href: string,
  exact?: boolean,
) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
