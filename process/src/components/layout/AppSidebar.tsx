"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  FileStack,
  GitBranch,
  LayoutDashboard,
  Menu,
  Network,
  PanelLeft,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";

const NAV_GROUPS = [
  {
    label: "Процесс төв",
    items: [
      {
        href: "/dashboard",
        label: "Самбар",
        short: "Самбар",
        icon: LayoutDashboard,
      },
      {
        href: "/processes",
        label: "Процессын зураг",
        short: "Зураг",
        icon: Network,
      },
      {
        href: "/documents",
        label: "Диаграмм · баримт",
        short: "Баримт",
        icon: FileStack,
      },
      {
        href: "/nodes",
        label: "Зангилаанууд",
        short: "Зангилаа",
        icon: GitBranch,
      },
    ],
  },
  {
    label: "Тохиргоо",
    items: [
      {
        href: "/settings",
        label: "Тохиргоо",
        short: "Тохиргоо",
        icon: Settings,
      },
    ],
  },
];

const NAV = NAV_GROUPS.flatMap((g) => g.items);

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItems({
  onNavigate,
  expanded,
}: {
  onNavigate?: () => void;
  expanded: boolean;
}) {
  const pathname = usePathname() || "/";
  return (
    <nav className="soft-scroll flex-1 space-y-0.5 overflow-x-hidden p-2">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="pb-3 last:pb-0">
          {expanded ? (
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-teal-300">
              {group.label}
            </div>
          ) : (
            <div className="mx-auto mb-1 h-px w-6 bg-white/15" aria-hidden />
          )}
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActivePath(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  title={item.label}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md py-2.5 text-sm transition",
                    expanded ? "px-3" : "justify-center px-2",
                    active
                      ? "bg-[var(--brand)] text-white"
                      : "text-white/75 hover:bg-white/8 hover:text-white",
                  )}
                >
                  <Icon size={18} className="shrink-0" />
                  <span
                    className={cn(
                      "truncate leading-snug transition-opacity duration-150",
                      expanded ? "opacity-100" : "sr-only",
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function AppSidebar({
  pinned,
  onPinnedChange,
}: {
  pinned: boolean;
  onPinnedChange: (pinned: boolean) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expanded = pinned || hovered;

  useEffect(() => {
    return () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, []);

  function onPointerEnter(e: React.PointerEvent) {
    if (e.pointerType === "touch") return;
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setHovered(true);
  }

  function onPointerLeave(e: React.PointerEvent) {
    if (e.pointerType === "touch") return;
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => setHovered(false), 120);
  }

  function togglePin() {
    onPinnedChange(!pinned);
    setHovered(false);
  }

  return (
    <>
      <aside
        className="relative z-40 hidden w-16 shrink-0 md:block"
        aria-hidden
      />
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 hidden flex-col border-r border-white/10 bg-[var(--sidebar)] text-[var(--sidebar-fg)] transition-[width,box-shadow] duration-200 ease-out md:flex",
          expanded ? "w-64 shadow-xl shadow-black/30" : "w-16",
        )}
        aria-label="Үндсэн цэс"
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
      >
        <div
          className={cn(
            "flex h-[3.75rem] items-center gap-2 border-b border-white/10",
            expanded ? "px-3" : "justify-center px-2",
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--brand)] text-white">
            <Network size={18} />
          </div>
          {expanded ? (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold tracking-wide">
                ПРОЦЕСС
              </div>
              <div className="truncate text-[11px] text-white/55">
                PFD · Single source of truth
              </div>
            </div>
          ) : null}
          {expanded ? (
            <button
              type="button"
              className="shrink-0 rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
              title={pinned ? "Бэхэлгээг болиулах" : "Цэсийг бэхлэх"}
              aria-pressed={pinned}
              onClick={togglePin}
            >
              <PanelLeft
                size={16}
                className={pinned ? "text-teal-300" : ""}
              />
            </button>
          ) : null}
        </div>

        <NavItems expanded={expanded} />

        <div
          className={cn(
            "border-t border-white/10",
            expanded ? "px-3 py-2" : "flex justify-center py-2",
          )}
        >
          {expanded ? (
            <div className="px-1 py-1 text-[11px] text-white/45">
              Холбогдсон: INSPECT-MN платформ
            </div>
          ) : (
            <button
              type="button"
              className="rounded-md p-2 text-white/55 hover:bg-white/10 hover:text-white"
              title="Цэсийг бэхлэх"
              onClick={() => onPinnedChange(true)}
            >
              <PanelLeft size={16} />
            </button>
          )}
        </div>
      </div>
    </>
  );
}

export function MobileChrome({
  children,
  pinned,
  onTogglePin,
}: {
  children: React.ReactNode;
  pinned: boolean;
  onTogglePin: () => void;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || "/";
  const tabs = NAV.slice(0, 4);

  function onMenuClick() {
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(min-width: 768px)").matches
    ) {
      onTogglePin();
      return;
    }
    setOpen(true);
  }

  return (
    <div className="relative flex h-[100dvh] min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--card)] px-3 py-2">
        <button
          type="button"
          className="rounded-md border border-[var(--border)] p-2"
          onClick={onMenuClick}
          aria-label={pinned ? "Цэс хураах" : "Цэс нээх"}
          aria-expanded={pinned || open}
        >
          <Menu size={16} />
        </button>
        <div className="min-w-0 flex-1 truncate text-sm font-semibold">
          Процесс модуль
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Хаах"
            onClick={() => setOpen(false)}
          />
          <aside className="relative z-50 flex h-full w-[min(20rem,86vw)] flex-col bg-[var(--sidebar)] text-[var(--sidebar-fg)] shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
              <div className="text-sm font-semibold">ПРОЦЕСС ТӨВ</div>
              <button
                type="button"
                className="rounded p-2 hover:bg-white/10"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <NavItems expanded onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="soft-scroll min-h-0 min-w-0 flex-1 pb-16 md:pb-0">
        {children}
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_95%,transparent)] backdrop-blur md:hidden"
        aria-label="Доод цэс"
      >
        <div className="grid grid-cols-4 gap-1 px-1 py-1">
          {tabs.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-md px-1 py-2 text-[10px] font-medium",
                  active
                    ? "bg-teal-50 text-[var(--brand)] dark:bg-teal-500/10"
                    : "text-[var(--muted)]",
                )}
              >
                <Icon size={18} />
                <span className="max-w-full truncate">{item.short}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
