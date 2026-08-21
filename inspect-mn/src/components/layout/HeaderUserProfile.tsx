"use client";

import Link from "next/link";
import { User } from "lucide-react";

export type HeaderProfile = {
  full_name?: string | null;
  position_name?: string | null;
  email?: string | null;
  alba_name?: string | null;
  role_label?: string | null;
};

export function HeaderUserProfile({
  profile,
  compact = false,
}: {
  profile: HeaderProfile | null;
  compact?: boolean;
}) {
  if (!profile) return null;

  const name = profile.full_name?.trim() || profile.email || "Хэрэглэгч";
  const title =
    profile.position_name?.trim() ||
    profile.role_label?.trim() ||
    profile.alba_name?.trim() ||
    null;

  return (
    <Link
      href="/settings/profile"
      className={`flex min-w-0 items-center gap-2 rounded-md border border-[var(--border)] bg-white px-2.5 py-1.5 text-left transition hover:border-[var(--brand)] ${
        compact ? "max-w-[11rem] sm:max-w-[14rem]" : "max-w-[16rem]"
      }`}
      title={[name, title].filter(Boolean).join(" · ")}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
        <User size={16} />
      </div>
      <div className="min-w-0 leading-tight">
        <div className="truncate text-sm font-semibold text-[var(--fg)]">{name}</div>
        {title ? (
          <div className="truncate text-[11px] text-[var(--muted)]">{title}</div>
        ) : null}
      </div>
    </Link>
  );
}
