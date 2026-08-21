"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Redirects employees away from admin settings subpages. */
export function SettingsAdminRedirect() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me/access", { cache: "no-store" });
        const data = await res.json();
        if (cancelled) return;
        const perms: string[] = data.permissions ?? [];
        const ok =
          data.isAdmin ||
          perms.includes("portal.settings") ||
          perms.includes("portal.admin");
        if (!ok) router.replace("/settings/profile");
      } catch {
        if (!cancelled) router.replace("/settings/profile");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);
  return null;
}
