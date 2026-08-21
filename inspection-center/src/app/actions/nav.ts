export const ACTIONS_NAV = [
  { href: "/actions", label: "Тойм" },
  { href: "/actions/open", label: "Арилаагүй" },
  { href: "/actions/resolved", label: "Арилсан" },
] as const;

export function isActionsNavActive(pathname: string, href: string) {
  if (href === "/actions") return pathname === "/actions";
  return pathname === href || pathname.startsWith(`${href}/`);
}
