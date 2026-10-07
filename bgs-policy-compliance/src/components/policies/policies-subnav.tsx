"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  filterPolicySubnav,
  usePolicyNavFilter,
} from "@/lib/access/PolicyNavContext";

const TABS = [
  {
    href: "/policies",
    label: "Удирдлага",
    match: (p: string) =>
      p === "/policies" ||
      (p.startsWith("/policies/") &&
        !p.startsWith("/policies/review") &&
        !p.includes("/preview")),
  },
  {
    href: "/policies/review",
    label: "Шалгах",
    match: (p: string) =>
      p === "/policies/review" ||
      p.startsWith("/policies/review/") ||
      p.includes("/preview"),
  },
] as const;

export function PoliciesSubnav() {
  const pathname = usePathname() ?? "/";
  const { submenus } = usePolicyNavFilter();
  const items = filterPolicySubnav(TABS, "/policies", submenus);

  if (items.length === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap gap-1 border-b border-[var(--border)] pb-2">
      {items.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition",
              active
                ? "bg-orange-500 text-white"
                : "text-[var(--muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--fg)]",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
