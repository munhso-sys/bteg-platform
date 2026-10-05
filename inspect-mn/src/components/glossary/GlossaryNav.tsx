"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/glossary", label: "Толь бичиг", exact: true },
  { href: "/glossary/database", label: "Үндсэн мэдээлэл" },
];

export function GlossaryNav() {
  const pathname = usePathname();

  return (
    <nav
      className="mb-5 flex gap-1 overflow-x-auto border-b border-[var(--border)]"
      aria-label="Толь бичиг дэд цэс"
    >
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-[var(--brand)] text-[var(--brand)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--fg)]",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
