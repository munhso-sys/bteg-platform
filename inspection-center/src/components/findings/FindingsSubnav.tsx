"use client";

import { usePathname } from "next/navigation";
import { FINDINGS_NAV, isFindingsNavActive } from "@/app/findings/nav";
import { EmbedLink } from "@/components/access/EmbedLink";

export function FindingsSubnav() {
  const pathname = usePathname();

  return (
    <nav
      className="mb-4 border-b border-[var(--border)]"
      aria-label="Зөрчлийн хэсгүүд"
    >
      <div className="flex flex-wrap gap-1">
        {FINDINGS_NAV.map((item) => {
          const active = isFindingsNavActive(pathname, item.href);
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
