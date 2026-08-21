"use client";

import { Building2, Moon, Users } from "lucide-react";
import { EmbedLink } from "@/components/access/EmbedLink";

const LINKS = [
  {
    href: "/findings/state",
    title: "Төрийн ХШ харах",
    body: "Байгууллага, хуудсаар бүртгэгдсэн зөрчил",
    icon: Building2,
  },
  {
    href: "/findings/night",
    title: "Шөнийн ХШ харах",
    body: "Талбай, хэсгээр бүртгэгдсэн зөрчил",
    icon: Moon,
  },
  {
    href: "/findings/joint",
    title: "Хамтарсан ХШ харах",
    body: "Ангиллаар бүртгэгдсэн зөрчил",
    icon: Users,
  },
] as const;

export function FindingsOverviewLinks() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {LINKS.map((item) => {
        const Icon = item.icon;
        return (
          <EmbedLink
            key={item.href}
            href={item.href}
            prefetch={false}
            className="flex items-start gap-3 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-3 transition hover:border-[var(--brand)]"
          >
            <Icon
              size={18}
              className="mt-0.5 shrink-0 text-[var(--brand)]"
              aria-hidden
            />
            <span>
              <span className="block text-sm font-semibold text-[var(--fg)]">
                {item.title}
              </span>
              <span className="mt-1 block text-sm text-[var(--muted)]">
                {item.body}
              </span>
            </span>
          </EmbedLink>
        );
      })}
    </div>
  );
}
