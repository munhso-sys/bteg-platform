"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isPlansNavActive, PLANS_NAV } from "@/app/plans/nav";
import {
  filterSubnavByAllowlist,
  useInspectionNavFilter,
} from "@/lib/access/InspectionNavContext";

export function PlansSubnav() {
  const pathname = usePathname();
  const { submenus } = useInspectionNavFilter();
  const items = filterSubnavByAllowlist(PLANS_NAV, "/plans", submenus);

  return (
    <nav
      className="mb-4 border-b border-[var(--border)]"
      aria-label="Төлөвлөгөөний хэсгүүд"
    >
      <div className="flex flex-wrap gap-1">
        {items.map((item) => {
          const active = isPlansNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
                active
                  ? "border-[var(--brand)] text-[var(--fg)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--fg)]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
