"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Fire-and-forget module/path usage beacon (local FS store via API). */
export function UsageBeacon() {
  const pathname = usePathname();
  const last = useRef<string>("");

  useEffect(() => {
    if (!pathname || pathname.startsWith("/login")) return;
    if (pathname === last.current) return;
    last.current = pathname;

    const moduleId =
      pathname === "/"
        ? "dashboard"
        : pathname.split("/").filter(Boolean)[0] || "unknown";

    void fetch("/api/usage/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "module_view",
        module: moduleId,
        path: pathname,
      }),
      keepalive: true,
    }).catch(() => {
      // ignore
    });
  }, [pathname]);

  return null;
}
