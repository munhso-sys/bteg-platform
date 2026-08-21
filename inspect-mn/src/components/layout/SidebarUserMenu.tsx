"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, User } from "lucide-react";
import type { HeaderProfile } from "@/components/layout/HeaderUserProfile";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { applyTheme, readStoredTheme } from "@/lib/theme";
import { cn } from "@/lib/cn";

export type { ThemeMode } from "@/lib/theme";
export { applyTheme, readStoredTheme } from "@/lib/theme";

export function SidebarUserMenu({
  profile,
  onNavigate,
  compact = false,
}: {
  profile: HeaderProfile | null;
  onNavigate?: () => void;
  /** Icon-only rail: always show avatar + menu (never hide). */
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    applyTheme(readStoredTheme());
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const name = profile?.full_name?.trim() || profile?.email || "Хэрэглэгч";
  const title =
    profile?.position_name?.trim() ||
    profile?.role_label?.trim() ||
    profile?.alba_name?.trim() ||
    null;

  const menu = open ? (
    <div
      className={cn(
        "absolute z-50 mb-1 overflow-hidden rounded-md border border-white/10 bg-[#111827] py-1 shadow-xl",
        compact
          ? "bottom-full left-1/2 w-56 -translate-x-1/2"
          : "bottom-full left-0 right-0",
      )}
    >
      <Link
        href="/settings/profile"
        className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-white/85 hover:bg-white/10"
        onClick={() => {
          setOpen(false);
          onNavigate?.();
        }}
      >
        <User size={16} />
        <span>Миний профайл</span>
      </Link>
      <LogoutButton
        variant="sidebar"
        className="rounded-none border-t border-white/10"
        onClick={() => {
          setOpen(false);
          onNavigate?.();
        }}
      />
    </div>
  ) : null;

  if (compact) {
    return (
      <div ref={rootRef} className="relative flex justify-center">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/15"
          title={name}
          aria-label={`${name} цэс`}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <User size={18} />
        </button>
        {menu}
      </div>
    );
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="flex items-center gap-1 rounded-md px-1.5 py-1.5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 px-1.5 py-1">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10 text-white">
            <User size={16} />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold text-white">{name}</div>
            {title ? (
              <div className="truncate text-[11px] text-white/55">{title}</div>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md p-2 text-white/70 hover:bg-white/10 hover:text-white"
          title="Цэс"
          aria-label="Цэс"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <MoreHorizontal size={18} />
        </button>
      </div>
      {menu}
    </div>
  );
}
