"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/guidance", label: "Удирдамж", exact: true },
  { href: "/guidance/other", label: "Бусад" },
];

export function GuidanceNav() {
  const pathname = usePathname();
  return <nav className="mb-4 flex gap-1 overflow-x-auto border-b border-[var(--border)]" aria-label="Удирдамжийн дэд цэс">{TABS.map((tab) => {
    const active = tab.exact ? pathname === tab.href : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
    return <Link key={tab.href} href={tab.href} className={cn("shrink-0 border-b-2 px-4 py-2.5 text-sm font-medium", active ? "border-[var(--brand)] text-[var(--brand)]" : "border-transparent text-[var(--muted)] hover:text-[var(--fg)]")}>{tab.label}</Link>;
  })}</nav>;
}
