export const FINDINGS_NAV = [
  { href: "/findings", label: "Тойм" },
  { href: "/findings/state", label: "Төрийн ХШ" },
  { href: "/findings/night", label: "Шөнийн ХШ" },
  { href: "/findings/joint", label: "Хамтарсан ХШ" },
] as const;

export function isFindingsNavActive(pathname: string, href: string) {
  if (href === "/findings") return pathname === "/findings";
  return pathname === href || pathname.startsWith(`${href}/`);
}
