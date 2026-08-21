"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  ClipboardList,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Megaphone,
  Menu,
  PanelLeft,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useShrinkCollapse } from "@/lib/use-shrink-collapse";

const NAV_GROUPS = [
  {
    label: "Судалгаа, хөгжлийн төв",
    items: [
      {
        href: "/dashboard",
        label: "Самбар",
        short: "Самбар",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Ажил",
    items: [
      {
        href: "/projects",
        label: "Судалгааны төслүүд",
        short: "Төсөл",
        icon: FlaskConical,
      },
      {
        href: "/program",
        label: "Хөтөлбөрийн ажил",
        short: "Ажил",
        icon: ClipboardList,
      },
    ],
  },
  {
    label: "Үр дүн",
    items: [
      {
        href: "/results",
        label: "Туршилт, үр дүн",
        short: "Үр дүн",
        icon: BarChart3,
      },
      {
        href: "/reports",
        label: "Судалгааны тайлан",
        short: "Тайлан",
        icon: FileText,
      },
      {
        href: "/feedback",
        label: "Санал асуулга",
        short: "Санал",
        icon: Megaphone,
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

const NAV = NAV_GROUPS.flatMap((group) => group.items);

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
    <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden p-2">
      {NAV_GROUPS.map((group) => {
        return (
          <div key={group.label} className="pb-3 last:pb-0">
            {expanded ? (
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--brand)]">
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
        );
      })}
    </nav>
  );
}

export function AppSidebar() {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [finePointer, setFinePointer] = useState(true);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expanded = pinned || hovered;

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setFinePointer(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    return () => {
      if (leaveTimer.current) clearTimeout(leaveTimer.current);
    };
  }, []);

  function onEnter() {
    if (!finePointer) return;
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setHovered(true);
  }

  function onLeave() {
    if (!finePointer) return;
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => setHovered(false), 120);
  }

  return (
    <aside className="relative z-40 hidden w-16 shrink-0 md:block" aria-label="Үндсэн цэс">
      <div
        className={cn(
          "absolute inset-y-0 left-0 flex h-[100dvh] flex-col border-r border-white/10 bg-[var(--sidebar)] text-[var(--sidebar-fg)] transition-[width,box-shadow] duration-200 ease-out",
          expanded ? "w-64 shadow-xl shadow-black/30" : "w-16",
        )}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        <div
          className={cn(
            "flex h-[3.75rem] items-center gap-2 border-b border-white/10",
            expanded ? "px-3" : "justify-center px-2",
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--brand)] text-white">
            <FlaskConical size={18} />
          </div>
          {expanded ? (
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold tracking-wide">
                СУДАЛГАА ХӨГЖҮҮЛЭЛТ
              </div>
              <div className="truncate text-[11px] text-white/55">
                Судалгаа, хөгжлийн төв
              </div>
            </div>
          ) : null}
          {expanded ? (
            <button
              type="button"
              className="shrink-0 rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
              title={pinned ? "Бэхэлгээг болиулах" : "Цэсийг бэхлэх"}
              aria-pressed={pinned}
              onClick={() => setPinned((v) => !v)}
            >
              <PanelLeft
                size={16}
                className={pinned ? "text-[var(--brand)]" : ""}
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
          {!expanded ? (
            <button
              type="button"
              className="rounded-md p-2 text-white/55 hover:bg-white/10 hover:text-white"
              title="Цэсийг бэхлэх"
              aria-label="Цэсийг бэхлэх"
              onClick={() => {
                setPinned(true);
                setHovered(true);
              }}
            >
              <PanelLeft size={16} />
            </button>
          ) : (
            <div className="px-1 py-1 text-[11px] text-white/45">
              Холбогдсон: INSPECT-MN платформ
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

export function MobileChrome({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() || "/";
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const collapsed = useShrinkCollapse(scrollEl);
  const tabs = NAV.slice(0, 4);

  return (
    <div className="relative flex h-[100dvh] min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-30 flex items-center gap-2 border-b border-[var(--border)] bg-[var(--card)] px-3 py-2 transition-transform duration-300 ease-out will-change-transform md:hidden",
          collapsed && "-translate-y-full",
        )}
      >
        <button
          type="button"
          className="rounded-md border border-[var(--border)] p-2"
          onClick={() => setOpen(true)}
          aria-label="Цэс нээх"
        >
          <Menu size={16} />
        </button>
        <div className="text-sm font-semibold">Судалгаа хөгжүүлэлт</div>
      </header>
      <div className="h-12 shrink-0 md:hidden" aria-hidden />

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
              <div className="text-sm font-semibold">СУДАЛГАА, ХӨГЖЛИЙН ТӨВ</div>
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

      <div
        ref={setScrollEl}
        className="min-h-0 min-w-0 flex-1 overflow-auto pb-16 md:pb-0"
      >
        <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-5 sm:py-5">
          {children}
        </div>
      </div>

      <nav
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_95%,transparent)] backdrop-blur transition-transform duration-300 ease-out will-change-transform md:hidden",
          collapsed && "translate-y-full",
        )}
        style={{ paddingBottom: "var(--safe-bottom, 0px)" }}
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
                    ? "bg-orange-50 text-[var(--brand)] dark:bg-amber-500/10"
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
