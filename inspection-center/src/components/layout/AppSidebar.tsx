"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  FileStack,
  PlayCircle,
  AlertTriangle,
  CheckSquare,
  Paperclip,
  BarChart3,
  Upload,
  Settings,
  ShieldCheck,
  Menu,
  X,
  PanelLeft,
} from "lucide-react";
import { useShrinkCollapse } from "@/lib/use-shrink-collapse";
import { useEmbedHref } from "@/lib/access/use-embed-href";
import {
  filterMenusByAllowlist,
  useInspectionNavFilter,
} from "@/lib/access/InspectionNavContext";

const NAV = [
  { href: "/dashboard", label: "Самбар", short: "Самбар", icon: LayoutDashboard },
  { href: "/plans", label: "Шалгалтын төлөвлөгөө", short: "Төлөвлөгөө", icon: ClipboardList },
  { href: "/runs", label: "Шалгалтын гүйцэтгэл", short: "Гүйцэтгэл", icon: PlayCircle },
  { href: "/templates", label: "Хяналтын хуудсууд", short: "Хуудас", icon: FileStack },
  { href: "/findings", label: "Зөрчлүүд", short: "Зөрчил", icon: AlertTriangle },
  { href: "/actions", label: "Засах арга хэмжээ", short: "Засвар", icon: CheckSquare },
  { href: "/evidence", label: "Нотлох баримт", short: "Баримт", icon: Paperclip },
  { href: "/analytics", label: "Шинжилгээ", short: "Шинжилгээ", icon: BarChart3 },
  { href: "/imports", label: "Импорт", short: "Импорт", icon: Upload },
  { href: "/settings", label: "Тохиргоо", short: "Тохиргоо", icon: Settings },
];

const NAV_UNIT = [
  { href: "/dashboard", label: "Самбар", short: "Самбар", icon: LayoutDashboard },
  { href: "/plans", label: "Төлөвлөгөө", short: "Төлөвлөгөө", icon: ClipboardList },
  { href: "/runs", label: "Гүйцэтгэл", short: "Гүйцэтгэл", icon: PlayCircle },
  { href: "/findings", label: "Зөрчлүүд", short: "Зөрчил", icon: AlertTriangle },
  { href: "/actions", label: "Засвар", short: "Засвар", icon: CheckSquare },
  { href: "/analytics", label: "Шинжилгээ", short: "Шинжилгээ", icon: BarChart3 },
];

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function isDesktopRail() {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
}

function NavItems({
  onNavigate,
  expanded,
  items,
}: {
  onNavigate?: () => void;
  expanded: boolean;
  items: typeof NAV;
}) {
  const pathname = usePathname();
  const { withEmbed } = useEmbedHref();
  const { menus } = useInspectionNavFilter();
  const visible = filterMenusByAllowlist(items, menus);
  return (
    <nav className="soft-scroll flex-1 space-y-0.5 overflow-x-hidden p-2">
      {visible.map((item) => {
        const active = isActivePath(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={withEmbed(item.href)}
            onClick={onNavigate}
            title={item.label}
            className={`flex items-center gap-2.5 rounded-md py-2.5 text-sm transition ${
              expanded ? "px-3" : "justify-center px-2"
            } ${
              active
                ? "bg-[var(--brand)] text-white"
                : "text-white/75 hover:bg-white/8 hover:text-white"
            }`}
          >
            <Icon size={18} className="shrink-0" />
            <span
              className={`truncate leading-snug transition-opacity duration-150 ${
                expanded ? "opacity-100" : "sr-only"
              }`}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Desktop/tablet: fixed overlay rail — expands on hover (mouse/pen) or pin from banner Menu. */
export function AppSidebar({
  unitMode = false,
  unitLabel = null,
  pinned,
  onPinnedChange,
}: {
  unitMode?: boolean;
  unitLabel?: string | null;
  pinned: boolean;
  onPinnedChange: (pinned: boolean) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const items = unitMode ? NAV_UNIT : NAV;
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
      {/* Layout spacer — expanded rail overlays content (overflow style). */}
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
          {expanded ? (
            <>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--brand)] text-white">
                <ShieldCheck size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold tracking-wide">
                  ХЯНАЛТ ШАЛГАЛТ
                </div>
                <div className="truncate text-[11px] text-white/55">
                  {unitMode
                    ? unitLabel || "Нэгжийн хүрээ"
                    : "Үйл ажиллагааны самбар"}
                </div>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
                title={pinned ? "Бэхэлгээг болиулах" : "Цэсийг бэхлэх"}
                aria-pressed={pinned}
                onClick={togglePin}
              >
                <PanelLeft
                  size={16}
                  className={pinned ? "text-[var(--brand)]" : ""}
                />
              </button>
            </>
          ) : (
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--brand)] text-white hover:opacity-90"
              title="Цэсийг бэхлэх"
              aria-label="Цэсийг бэхлэх"
              onClick={() => onPinnedChange(true)}
            >
              <PanelLeft size={18} />
            </button>
          )}
        </div>

        <NavItems expanded={expanded} items={items} />

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
              aria-label="Цэсийг дэлгэх"
              onClick={() => onPinnedChange(true)}
            >
              <Menu size={16} />
            </button>
          ) : (
            <div className="px-1 py-1 text-[11px] text-white/45">
              Холбогдсон: бодлогын нийцлийн систем
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function MobileChrome({
  children,
  unitMode = false,
  pinned,
  onTogglePin,
}: {
  children: React.ReactNode;
  unitMode?: boolean;
  pinned: boolean;
  onTogglePin: () => void;
}) {
  const [open, setOpen] = useState(false);
  const items = unitMode ? NAV_UNIT : NAV;
  const pathname = usePathname() || "/";
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const collapsed = useShrinkCollapse(scrollEl);
  const tabs = items.slice(0, 4);
  const { withEmbed } = useEmbedHref();

  function onMenuClick() {
    if (isDesktopRail()) {
      onTogglePin();
      return;
    }
    setOpen(true);
  }

  return (
    <div className="relative flex h-[100dvh] min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <header
        className={cn(
          "z-30 flex shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--card)] px-3 py-2 transition-transform duration-300 ease-out will-change-transform",
          collapsed && "-translate-y-full md:translate-y-0",
        )}
      >
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
          Хяналт шалгалтын төв
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
              <div className="text-sm font-semibold">ХЯНАЛТ ШАЛГАЛТЫН ТӨВ</div>
              <button
                type="button"
                className="rounded p-2 hover:bg-white/10"
                onClick={() => setOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <NavItems
              expanded
              items={items}
              onNavigate={() => setOpen(false)}
            />
          </aside>
        </div>
      ) : null}

      <div
        ref={setScrollEl}
        className="soft-scroll min-h-0 min-w-0 flex-1 pb-16 md:pb-0"
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
        <div
          className="grid gap-1 px-1 py-1"
          style={{
            gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
          }}
        >
          {tabs.map((item) => {
            const active = isActivePath(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={withEmbed(item.href)}
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
