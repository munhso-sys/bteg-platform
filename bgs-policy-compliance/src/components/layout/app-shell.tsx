"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Building2,
  ClipboardCheck,
  FileStack,
  GitBranch,
  LayoutDashboard,
  Menu,
  PanelLeft,
  Settings,
  ShieldCheck,
  Upload,
  Users,
  X,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useShrinkCollapse } from "@/lib/use-shrink-collapse";

type NavChild = {
  href: string;
  label: string;
  match?: (pathname: string) => boolean;
};

type NavItem = {
  href: string;
  label: string;
  short: string;
  icon: typeof LayoutDashboard;
  children?: NavChild[];
};

const NAV_FULL: NavItem[] = [
  { href: "/dashboard", label: "Хянах самбар", short: "Самбар", icon: LayoutDashboard },
  { href: "/org", label: "Алба, хэлтэс", short: "Нэгж", icon: Building2 },
  {
    href: "/policies",
    label: "Журмууд",
    short: "Журам",
    icon: FileStack,
    children: [
      {
        href: "/policies",
        label: "Удирдлага",
        match: (p) =>
          p === "/policies" ||
          (p.startsWith("/policies/") &&
            !p.startsWith("/policies/review") &&
            !p.includes("/preview")),
      },
      {
        href: "/policies/review",
        label: "Шалгах",
        match: (p) =>
          p === "/policies/review" ||
          p.startsWith("/policies/review/") ||
          p.includes("/preview"),
      },
    ],
  },
  {
    href: "/positions",
    label: "Ажлын байр",
    short: "Албан",
    icon: Users,
    children: [
      {
        href: "/positions",
        label: "Удирдлага",
        match: (p) =>
          p === "/positions" ||
          (p.startsWith("/positions/") &&
            !p.startsWith("/positions/review") &&
            !p.includes("/preview")),
      },
      {
        href: "/positions/review",
        label: "Шалгах",
        match: (p) =>
          p === "/positions/review" ||
          p.startsWith("/positions/review/") ||
          p.includes("/preview"),
      },
    ],
  },
  { href: "/matrix", label: "Холбоосын хүснэгт", short: "Матриц", icon: GitBranch },
  { href: "/evaluations", label: "Үнэлгээ", short: "Үнэлгээ", icon: ClipboardCheck },
  { href: "/imports", label: "Импорт", short: "Импорт", icon: Upload },
  { href: "/settings", label: "Тохиргоо", short: "Тохиргоо", icon: Settings },
];

function isActivePath(pathname: string, href: string) {
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

function isChildActive(pathname: string, child: NavChild) {
  if (child.match) return child.match(pathname);
  return isActivePath(pathname, child.href);
}

function SideNav({
  onNavigate,
  expanded,
  items,
}: {
  onNavigate?: () => void;
  expanded: boolean;
  items: NavItem[];
}) {
  const pathname = usePathname() ?? "/";
  // Defer active styling until after mount so SSR HTML matches the first client paint
  // (usePathname can differ between RSC pass and hydration in embed/iframe contexts).
  const [navReady, setNavReady] = useState(false);
  useEffect(() => {
    setNavReady(true);
  }, []);
  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden p-2">
      {items.map((item) => {
        const active = navReady && isActivePath(pathname, item.href);
        const Icon = item.icon;
        const showChildren = expanded && Boolean(item.children?.length);
        return (
          <div key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              title={item.label}
              className={cn(
                "flex items-center gap-2.5 rounded-md py-2.5 text-sm font-medium transition",
                expanded ? "px-3" : "justify-center px-2",
                active
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-white/75 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon size={18} className="shrink-0" />
              <span className={expanded ? "truncate" : "sr-only"}>{item.label}</span>
            </Link>
            {showChildren ? (
              <div className="ml-3 mt-0.5 space-y-0.5 border-l border-white/15 pl-2">
                {item.children!.map((child) => {
                  const childActive = navReady && isChildActive(pathname, child);
                  return (
                    <Link
                      key={`${item.href}::${child.href}`}
                      href={child.href}
                      onClick={onNavigate}
                      className={cn(
                        "block rounded-md px-2.5 py-1.5 text-xs font-medium transition",
                        childActive
                          ? "bg-white/20 text-white"
                          : "text-white/65 hover:bg-white/10 hover:text-white",
                      )}
                    >
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

function DesktopRail({
  items,
  scopedLabel,
}: {
  items: NavItem[];
  scopedLabel?: string | null;
}) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [finePointer, setFinePointer] = useState(false);
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
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-orange-500 text-white">
            <ShieldCheck size={18} />
          </div>
          {expanded ? (
            <>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold tracking-wide">
                  POLICY
                </div>
                <div className="truncate text-[11px] text-white/55">
                  {scopedLabel ? `Ажилтан · ${scopedLabel}` : "Журмын биелэлт"}
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                title={pinned ? "Бэхэлгээг болиулах" : "Цэсийг бэхлэх"}
                aria-pressed={pinned}
                onClick={() => setPinned((v) => !v)}
              >
                <PanelLeft
                  size={16}
                  className={pinned ? "text-orange-400" : ""}
                />
              </button>
            </>
          ) : null}
        </div>
        <SideNav expanded={expanded} items={items} />
      </div>
    </aside>
  );
}

function MobileTabBar({
  items,
  collapsed,
}: {
  items: NavItem[];
  collapsed: boolean;
}) {
  const pathname = usePathname() ?? "/";
  const [navReady, setNavReady] = useState(false);
  useEffect(() => {
    setNavReady(true);
  }, []);
  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-white/95 backdrop-blur transition-transform duration-300 ease-out will-change-transform md:hidden dark:bg-[color-mix(in_srgb,var(--card)_95%,transparent)]",
        collapsed && "translate-y-full",
      )}
    >
      <div
        className="grid gap-1 px-1 py-1"
        style={{
          gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))`,
        }}
      >
        {items.slice(0, 4).map((item) => {
          const active = navReady && isActivePath(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-md px-1 py-2 text-[10px] font-medium",
                active
                  ? "bg-orange-50 text-orange-600 dark:bg-amber-500/10 dark:text-[var(--brand)]"
                  : "text-[var(--muted)]",
              )}
            >
              <Icon size={18} />
              <span>{item.short}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function AppShell({
  children,
  mode = "full",
  positionId = null,
  positionName = null,
  heltesId = null,
  albaId = null,
  albaName = null,
  heltesName = null,
}: {
  children: React.ReactNode;
  mode?: "full" | "position" | "unit";
  positionId?: string | null;
  positionName?: string | null;
  heltesId?: string | null;
  albaId?: string | null;
  albaName?: string | null;
  heltesName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const positionScoped = mode === "position";
  const unitScoped = mode === "unit";
  const unitHome =
    heltesId && albaId
      ? `/org/heltes/${heltesId}/alba/${albaId}`
      : heltesId
        ? `/org/heltes/${heltesId}`
        : "/org";
  const home = positionId ? `/positions/${positionId}` : "/my";
  const unitLabel = albaName || heltesName || "Миний нэгж";
  const items: NavItem[] = positionScoped
    ? [
        { href: "/my", label: "Миний үүрэг", short: "Үүрэг", icon: UserRound },
        {
          href: home,
          label: positionName || "Ажлын байр",
          short: "АБ",
          icon: Users,
        },
      ]
    : unitScoped
      ? [
          {
            href: "/dashboard",
            label: "Хянах самбар",
            short: "Самбар",
            icon: LayoutDashboard,
          },
          {
            href: unitHome,
            label: unitLabel,
            short: "Нэгж",
            icon: Building2,
          },
          {
            href: `${unitHome}/policies`,
            label: "Журмууд",
            short: "Журам",
            icon: FileStack,
          },
          {
            href: `${unitHome}/positions`,
            label: "Ажлын байр",
            short: "Албан",
            icon: Users,
          },
          {
            href: "/evaluations",
            label: "Үнэлгээ",
            short: "Үнэлгээ",
            icon: ClipboardCheck,
          },
        ]
      : NAV_FULL;

  const scopedLabel = positionScoped
    ? positionName
    : unitScoped
      ? unitLabel
      : null;
  const headerTitle = positionScoped
    ? "Миний журмын үүрэг"
    : unitScoped
      ? `Журмын биелэлт · ${unitLabel}`
      : "Журмын биелэлт";

  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const collapsed = useShrinkCollapse(scrollEl);

  return (
    <div className="flex h-[100dvh] min-h-0 overflow-hidden bg-[var(--background)] text-[var(--fg)]">
      <DesktopRail items={items} scopedLabel={scopedLabel} />

      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
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
            aria-label="Open menu"
          >
            <Menu size={16} />
          </button>
          <ShieldCheck size={16} className="text-orange-500" />
          <span className="text-sm font-semibold">{headerTitle}</span>
        </header>
        <div className="h-12 shrink-0 md:hidden" aria-hidden />

        {open ? (
          <div className="fixed inset-0 z-50 md:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              aria-label="Close"
              onClick={() => setOpen(false)}
            />
            <aside className="relative z-50 flex h-full w-[min(20rem,86vw)] flex-col bg-[var(--sidebar)] text-[var(--sidebar-fg)] shadow-xl">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
                <div className="text-sm font-semibold">POLICY COMPLIANCE</div>
                <button
                  type="button"
                  className="rounded p-2 hover:bg-white/10"
                  onClick={() => setOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
              <SideNav expanded onNavigate={() => setOpen(false)} items={items} />
            </aside>
          </div>
        ) : null}

        <main
          ref={setScrollEl}
          className="min-h-0 min-w-0 flex-1 overflow-auto pb-16 md:pb-0"
        >
          <div className="mx-auto max-w-[1400px] px-3 py-4 sm:px-5 sm:py-5">
            {children}
          </div>
        </main>

        <MobileTabBar items={items} collapsed={collapsed} />
      </div>
    </div>
  );
}
