"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/report-analysis", label: "Нэгдсэн самбар", exact: true },
  { href: "/report-analysis/kpis", label: "KPI сан" },
  { href: "/report-analysis/analysis", label: "Шинжилгээ" },
  { href: "/report-analysis/tree", label: "Хавтас" },
  { href: "/report-analysis/operations", label: "Түвшин" },
  { href: "/report-analysis/report", label: "Албан тайлан" },
  { href: "/report-analysis/exports", label: "Экспорт" },
];

export function ReportsNav() {
  const pathname = usePathname();
  return (
    <div className="mb-4 flex flex-wrap gap-1 border-b border-[var(--border)] pb-px print:hidden">
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
