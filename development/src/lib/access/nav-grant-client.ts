"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";

function decodeNavMenuIds(token: string | null): string[] | null {
  if (!token) return null;
  const body = token.split(".")[0];
  if (!body) return null;
  try {
    const pad = body.length % 4 === 0 ? "" : "=".repeat(4 - (body.length % 4));
    const b64 = body.replace(/-/g, "+").replace(/_/g, "/") + pad;
    const json = atob(b64);
    const parsed = JSON.parse(json) as { menuIds?: unknown };
    if (!Array.isArray(parsed.menuIds)) return null;
    return parsed.menuIds.filter((x): x is string => typeof x === "string");
  } catch {
    return null;
  }
}

/** UI filter only — middleware verifies the signed nav grant. */
export function useNavMenuAllowlist(): string[] | null {
  const sp = useSearchParams();
  return useMemo(() => decodeNavMenuIds(sp.get("nav")), [sp]);
}

export function withNavQuery(href: string, nav: string | null): string {
  if (!nav) return href;
  const join = href.includes("?") ? "&" : "?";
  return `${href}${join}nav=${encodeURIComponent(nav)}`;
}
