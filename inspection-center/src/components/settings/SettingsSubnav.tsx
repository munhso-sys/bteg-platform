"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isSettingsNavActive, SETTINGS_NAV } from "@/app/settings/nav";
import { ThemeToggleButton } from "@/components/theme-toggle";

export function SettingsSubnav({
  showDataReset = false,
}: {
  showDataReset?: boolean;
}) {
  const pathname = usePathname();
  const items = SETTINGS_NAV.filter(
    (item) => !("adminOnly" in item && item.adminOnly) || showDataReset,
  );

  return (
    <nav
      className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-[var(--border)]"
      aria-label="Тохиргооны хэсгүүд"
    >
      <div className="flex flex-wrap gap-1">
        {items.map((item) => {
          const exact = "exact" in item ? Boolean(item.exact) : false;
          const active = isSettingsNavActive(pathname, item.href, exact);
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
      <ThemeToggleButton />
    </nav>
  );
}
