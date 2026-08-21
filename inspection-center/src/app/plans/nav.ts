export const PLANS_NAV = [
  { href: "/plans", label: "Тойм" },
  { href: "/plans/by-type", label: "Төрлөөр" },
  { href: "/plans/annual", label: "Хуудсаар" },
  { href: "/plans/gaps", label: "Үлдсэн" },
] as const;

export function isPlansNavActive(pathname: string, href: string) {
  if (href === "/plans") return pathname === "/plans";
  return pathname === href || pathname.startsWith(`${href}/`);
}
