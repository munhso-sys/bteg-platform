"use client";

import { EmbedLink } from "@/components/access/EmbedLink";

/** Cross-links between findings report and corrective-action pages. */
export function FindingsActionsCrossLinks({
  openHref = "/actions/open",
  resolvedHref = "/actions/resolved",
}: {
  openHref?: string;
  resolvedHref?: string;
}) {
  return (
    <div className="mb-3 flex flex-wrap gap-2 text-sm">
      <EmbedLink
        href={openHref}
        prefetch={false}
        className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[var(--brand-dark)] hover:border-[var(--brand)]"
      >
        Арилаагүй зөрчил →
      </EmbedLink>
      <EmbedLink
        href={resolvedHref}
        prefetch={false}
        className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[var(--brand-dark)] hover:border-[var(--brand)]"
      >
        Арилсан зөрчил →
      </EmbedLink>
    </div>
  );
}

export function ActionsFindingsCrossLinks() {
  return (
    <div className="mb-3 flex flex-wrap gap-2 text-sm">
      <EmbedLink
        href="/findings/state"
        prefetch={false}
        className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[var(--brand-dark)] hover:border-[var(--brand)]"
      >
        ← Төрийн ХШ зөрчил
      </EmbedLink>
      <EmbedLink
        href="/findings/night"
        prefetch={false}
        className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[var(--brand-dark)] hover:border-[var(--brand)]"
      >
        ← Шөнийн ХШ зөрчил
      </EmbedLink>
      <EmbedLink
        href="/findings/joint"
        prefetch={false}
        className="rounded-md border border-[var(--border)] px-2.5 py-1.5 text-[var(--brand-dark)] hover:border-[var(--brand)]"
      >
        ← Хамтарсан ХШ зөрчил
      </EmbedLink>
    </div>
  );
}
