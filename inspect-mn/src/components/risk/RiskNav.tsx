"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/risk-management", label: "Самбар", exact: true },
  { href: "/risk-management/register", label: "Бүртгэл" },
  { href: "/risk-management/matrix", label: "Матриц" },
  { href: "/risk-management/work", label: "Засвар" },
  { href: "/risk-management/sources", label: "Эх үүсвэр" },
  { href: "/risk-management/tree", label: "Хавтас" },
];

export function RiskNav() {
  const pathname = usePathname();
  return (
    <div className="mb-4 flex flex-wrap gap-1 border-b border-[var(--border)] pb-px">
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "shrink-0 rounded-t-md px-3 py-2 text-sm font-medium",
              active
                ? "border border-b-[var(--card)] border-[var(--border)] bg-[var(--card)] text-[var(--fg)]"
                : "text-[var(--muted)] hover:text-[var(--fg)]",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
