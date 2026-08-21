"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { withRange } from "./useSmartMineOverview";

const TABS = [
  { href: "/smartmine", label: "Dashboard", exact: true },
  { href: "/smartmine/processing", label: "Processing" },
  { href: "/smartmine/equipment", label: "Equipment" },
  { href: "/smartmine/maintenance", label: "Maintenance" },
  { href: "/smartmine/reason-tool", label: "Reason Tool" },
];

export function SmartMineNav({ from, to }: { from: string; to: string }) {
  const pathname = usePathname();
  return (
    <div className="mb-3 flex flex-wrap gap-1 border-b border-[var(--border)] pb-px">
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={withRange(tab.href, from, to)}
            className={cn(
              "shrink-0 rounded-t-md px-2.5 py-1.5 text-sm font-medium",
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
