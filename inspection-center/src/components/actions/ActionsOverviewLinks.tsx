"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { EmbedLink } from "@/components/access/EmbedLink";

export function ActionsOverviewLinks() {
  return (
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <EmbedLink
        href="/actions/open"
        prefetch={false}
        className="flex items-start gap-3 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-3 transition hover:border-[var(--brand)]"
      >
        <AlertTriangle
          size={18}
          className="mt-0.5 shrink-0 text-[var(--brand)]"
          aria-hidden
        />
        <span>
          <span className="block text-sm font-semibold text-[var(--fg)]">
            Арилаагүй зөрчил
          </span>
          <span className="mt-1 block text-sm text-[var(--muted)]">
            Шүүлтүүр, төлөвлөгөө, эрсдэлийн жагсаалт
          </span>
        </span>
      </EmbedLink>
      <EmbedLink
        href="/actions/resolved"
        prefetch={false}
        className="flex items-start gap-3 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-3 transition hover:border-[var(--brand)]"
      >
        <CheckCircle2
          size={18}
          className="mt-0.5 shrink-0 text-[var(--brand)]"
          aria-hidden
        />
        <span>
          <span className="block text-sm font-semibold text-[var(--fg)]">
            Арилсан зөрчил
          </span>
          <span className="mt-1 block text-sm text-[var(--muted)]">
            Архив, хайлт, дэлгэрэнгүй
          </span>
        </span>
      </EmbedLink>
    </div>
  );
}
