"use client";

import { usePathname } from "next/navigation";
import { ACTIONS_NAV, isActionsNavActive } from "@/app/actions/nav";
import { EmbedLink } from "@/components/access/EmbedLink";
import {
  filterSubnavByAllowlist,
  useInspectionNavFilter,
} from "@/lib/access/InspectionNavContext";

export function ActionsSubnav() {
  const pathname = usePathname();
  const { submenus } = useInspectionNavFilter();
  const items = filterSubnavByAllowlist(ACTIONS_NAV, "/actions", submenus);

  return (
    <nav
      className="mb-4 border-b border-[var(--border)]"
      aria-label="Арга хэмжээний хэсгүүд"
    >
      <div className="flex flex-wrap gap-1">
        {items.map((item) => {
          const active = isActionsNavActive(pathname, item.href);
          return (
            <EmbedLink
              key={item.href}
              href={item.href}
              prefetch={false}
              aria-current={active ? "page" : undefined}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition ${
                active
                  ? "border-[var(--brand)] text-[var(--fg)]"
                  : "border-transparent text-[var(--muted)] hover:text-[var(--fg)]"
              }`}
            >
              {item.label}
            </EmbedLink>
          );
        })}
      </div>
    </nav>
  );
}
