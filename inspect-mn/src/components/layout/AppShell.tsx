"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, Menu, PanelLeft, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  SidebarUserMenu,
} from "@/components/layout/SidebarUserMenu";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import type { HeaderProfile } from "@/components/layout/HeaderUserProfile";
import { IdleLogout } from "@/components/auth/IdleLogout";
import { UsageBeacon } from "@/components/management/UsageBeacon";
import { applyTheme, readStoredTheme, type ThemeMode } from "@/lib/theme";
import {
  usePortalChromeCollapse,
  useShrinkCollapse,
} from "@/lib/use-portal-chrome-collapse";
import {
  GROUP_LABELS,
  MODULES,
  type ModuleGroup,
  type PlatformModule,
} from "@/lib/modules";
import { isDutyRoute } from "@/lib/module-apps";
import { cn } from "@/lib/cn";

const GROUPS: ModuleGroup[] = ["duty", "result", "tools"];

function NavLinks({
  modules,
  onNavigate,
  expanded,
}: {
  modules: PlatformModule[];
  onNavigate?: () => void;
  expanded: boolean;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-4">
      <Link
        href="/"
        onClick={onNavigate}
        title="Dashboard"
        className={cn(
          "flex items-center gap-2.5 rounded-md py-2.5 text-sm transition",
          expanded ? "px-3" : "justify-center px-2",
          pathname === "/"
            ? "bg-[var(--brand)] text-white"
            : "text-white/75 hover:bg-white/10 hover:text-white",
        )}
      >
        <ShieldCheck size={18} className="shrink-0" />
        <span className={expanded ? "truncate" : "sr-only"}>Dashboard</span>
      </Link>

      {GROUPS.map((group) => {
        const items = modules.filter((m) => m.group === group);
        if (items.length === 0) return null;
        return (
          <div key={group}>
            {expanded ? (
              <div className="px-3 pb-1 text-[10px] font-bold tracking-[0.14em] text-[var(--brand)]">
                {GROUP_LABELS[group]}
              </div>
            ) : (
              <div className="mx-auto mb-1 h-px w-6 bg-white/15" aria-hidden />
            )}
            <div className="space-y-0.5">
              {items.map((item) => {
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
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
                        : "text-white/75 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Icon size={18} className="shrink-0" />
                    <span
                      className={
                        expanded ? "truncate leading-snug" : "sr-only"
                      }
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
    </div>
  );
}

function DesktopRail({
  modules,
  profile,
}: {
  modules: PlatformModule[];
  profile: HeaderProfile | null;
}) {
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
    <aside className="relative z-40 hidden w-16 shrink-0 print:hidden lg:block" aria-label="Платформ цэс">
      <div
        className={cn(
          "absolute inset-y-0 left-0 flex h-full min-h-[100dvh] flex-col bg-[var(--sidebar)] text-[var(--sidebar-fg)] transition-[width,box-shadow] duration-200 ease-out",
          expanded ? "w-60 shadow-xl shadow-black/30" : "w-16",
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
          <div className="min-w-0">
            {expanded ? (
              <>
                <div className="text-sm font-semibold tracking-wide">
                  INSPECT-MN
                </div>
                <div className="text-[11px] text-white/50">Platform portal</div>
              </>
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--brand)] text-xs font-bold text-white">
                IN
              </div>
            )}
          </div>
          {expanded ? (
            <button
              type="button"
              className="ml-auto shrink-0 rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
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

        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2">
          <NavLinks modules={modules} expanded={expanded} />
        </nav>

        <div className="border-t border-white/10 p-2">
          <SidebarUserMenu profile={profile} compact={!expanded} />
        </div>
      </div>
    </aside>
  );
}

function MobileDrawer({
  open,
  onClose,
  modules,
  profile,
}: {
  open: boolean;
  onClose: () => void;
  modules: PlatformModule[];
  profile: HeaderProfile | null;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close menu"
        onClick={onClose}
      />
      <aside className="relative z-50 flex h-full w-[min(20rem,86vw)] flex-col bg-[var(--sidebar)] text-[var(--sidebar-fg)] shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-4 pt-[max(1rem,var(--safe-top))]">
          <div className="text-sm font-semibold">INSPECT-MN</div>
          <button
            type="button"
            className="rounded p-2 hover:bg-white/10"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          <NavLinks modules={modules} onNavigate={onClose} expanded />
        </nav>
        <div className="border-t border-white/10 p-2">
          <SidebarUserMenu profile={profile} onNavigate={onClose} />
        </div>
      </aside>
    </div>
  );
}

function BottomNav({
  modules,
  collapsed = false,
}: {
  modules: PlatformModule[];
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const primary = modules.filter((m) =>
    ["inspection", "policy-compliance", "development", "process", "guidance"].includes(
      m.id,
    ),
  );
  const items =
    primary.length >= 2 ? primary.slice(0, 4) : modules.slice(0, 4);

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_95%,transparent)] backdrop-blur transition-transform duration-300 ease-out will-change-transform print:hidden lg:hidden",
        collapsed && "translate-y-full",
      )}
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <div
        className="grid gap-1 px-1 py-1"
        style={{
          gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))`,
        }}
      >
        {items.map((m) => {
          const active =
            pathname === m.href || pathname.startsWith(`${m.href}/`);
          const Icon = m.icon;
          return (
            <Link
              key={m.href}
              href={m.href}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-md px-1 py-2 text-[10px] font-medium",
                active
                  ? "bg-orange-50 text-[var(--brand)] dark:bg-amber-500/10"
                  : "text-[var(--muted)]",
              )}
            >
              <Icon size={18} />
              <span className="max-w-full truncate">
                {m.id === "inspection"
                  ? "Хяналт"
                  : m.id === "policy-compliance"
                    ? "Журам"
                    : m.id === "development"
                      ? "СХ"
                      : m.id === "guidance"
                        ? "Удирдамж"
                      : m.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function DutyChrome({
  modules,
  children,
}: {
  modules: PlatformModule[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const collapsed = usePortalChromeCollapse();

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[var(--background)]">
      <IdleLogout />
      <header
        className={cn(
          "z-30 flex shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[var(--card)] px-2 py-2 transition-transform duration-300 ease-out will-change-transform sm:px-3",
          collapsed && "-translate-y-full",
        )}
      >
        <Link
          href="/"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-2 text-sm font-medium text-[var(--fg)] hover:bg-[var(--surface-muted)] sm:px-3"
        >
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">Платформ</span>
        </Link>
        <nav className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-1">
          {modules
            .filter((m) => m.group === "duty")
            .map((m) => {
              const active = pathname === m.href;
              const Icon = m.icon;
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded px-2.5 py-2 text-xs font-semibold",
                    active
                      ? "bg-[var(--brand)] text-white"
                      : "bg-[var(--surface-muted)] text-[var(--fg)]",
                  )}
                >
                  <Icon size={14} />
                  <span className="hidden sm:inline">{m.label}</span>
                </Link>
              );
            })}
          <ThemeToggle compact />
        </nav>
      </header>
      <div
        className={cn(
          "min-h-0 flex-1 transition-[margin] duration-300 ease-out",
          collapsed && "-mt-14",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [allowedIds, setAllowedIds] = useState<string[] | null>(null);
  const [profile, setProfile] = useState<HeaderProfile | null>(null);
  const pathname = usePathname();
  const duty = isDutyRoute(pathname);
  const isAuthPage =
    pathname === "/login" ||
    pathname === "/access-request" ||
    pathname === "/forgot-password" ||
    pathname === "/update-password";

  useEffect(() => {
    const mode: ThemeMode = readStoredTheme();
    applyTheme(mode);
  }, []);

  useEffect(() => {
    if (isAuthPage) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me/access", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        if (data.ok) {
          if (data.profile) {
            setProfile({
              full_name: data.profile.full_name,
              position_name: data.profile.position_name,
              email: data.profile.email,
              alba_name: data.profile.alba_name,
              role_label: data.profile.role_label ?? data.role_label,
            });
          } else if (data.role_label) {
            // Keep footer visible even if profile row is thin
            setProfile((prev) =>
              prev ?? {
                full_name: null,
                position_name: null,
                email: null,
                alba_name: null,
                role_label: data.role_label,
              },
            );
          }
          if (Array.isArray(data.modules)) {
            setAllowedIds(data.modules);
            return;
          }
        }
        setAllowedIds((prev) => prev ?? MODULES.map((m) => m.id));
      } catch {
        if (!cancelled) {
          setAllowedIds((prev) => prev ?? MODULES.map((m) => m.id));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthPage]);

  const modules = useMemo(() => {
    if (!allowedIds) return MODULES;
    return MODULES.filter((m) => allowedIds.includes(m.id));
  }, [allowedIds]);

  const activeModule = MODULES.find(
    (m) => pathname === m.href || pathname.startsWith(`${m.href}/`),
  );

  if (isAuthPage) {
    return <>{children}</>;
  }

  if (duty) {
    return (
      <>
        <UsageBeacon />
        <DutyChrome modules={modules}>{children}</DutyChrome>
      </>
    );
  }

  return (
    <>
      <UsageBeacon />
      <PortalChrome
        modules={modules}
        profile={profile}
        activeLabel={activeModule?.label ?? "Dashboard"}
        open={open}
        setOpen={setOpen}
      >
        {children}
      </PortalChrome>
    </>
  );
}

function PortalChrome({
  modules,
  profile,
  activeLabel,
  open,
  setOpen,
  children,
}: {
  modules: PlatformModule[];
  profile: HeaderProfile | null;
  activeLabel: string;
  open: boolean;
  setOpen: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const collapsed = useShrinkCollapse(scrollEl);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[var(--background)]">
      <IdleLogout />
      <DesktopRail modules={modules} profile={profile} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header
          className={cn(
            "z-30 flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_95%,transparent)] px-3 py-2 backdrop-blur transition-transform duration-300 ease-out will-change-transform print:hidden lg:px-4",
            collapsed && "-translate-y-full",
          )}
        >
          <button
            type="button"
            className="btn btn-ghost px-2 lg:hidden"
            onClick={() => setOpen(true)}
          >
            <Menu size={18} />
          </button>
          <div className="min-w-0 flex-1 truncate text-sm font-semibold">
            {activeLabel}
          </div>
          <ThemeToggle compact />
        </header>

        <main
          ref={setScrollEl}
          className={cn(
            "soft-scroll min-h-0 flex-1 px-3 py-4 pb-[calc(4.5rem+var(--safe-bottom))] transition-[margin] duration-300 ease-out print:p-0 lg:px-6 lg:pb-6",
            collapsed && "-mt-14",
          )}
        >
          {children}
        </main>
        <BottomNav modules={modules} collapsed={collapsed} />
      </div>

      <MobileDrawer
        open={open}
        onClose={() => setOpen(false)}
        modules={modules}
        profile={profile}
      />
    </div>
  );
}
