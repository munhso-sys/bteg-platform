"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/settings/profile", label: "Миний профайл", exact: true },
  { href: "/settings", label: "Ерөнхий", exact: true },
  { href: "/settings/access-requests", label: "Нэвтрэх хүсэлт" },
  { href: "/settings/users", label: "Хэрэглэгч / Role" },
  { href: "/settings/roles", label: "Role эрх" },
  { href: "/settings/temp-grants", label: "Хугацаатай эрх" },
  { href: "/settings/session", label: "Сесс / Auto logout" },
];

export function SettingsNav() {
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
