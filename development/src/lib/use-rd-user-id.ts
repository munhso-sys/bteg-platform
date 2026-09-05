"use client";

import { useEffect, useState } from "react";
import {
  RD_UID_QUERY,
  clearRdUserData,
  isInspectLogoutMessage,
  resolveRdUserIdFromSearch,
  sanitizeRdUserId,
} from "@/lib/rd-storage";

/**
 * Resolves portal user id for RD storage namespacing (RD-D02).
 * Prefer URL `rd_uid` from portal embed; fall back to sessionStorage cache.
 */
export function useRdUserId(): {
  userId: string | null;
  ready: boolean;
} {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const fromUrl = resolveRdUserIdFromSearch(window.location.search);
    const cached = sanitizeRdUserId(
      sessionStorage.getItem("rd-portal-uid"),
    );
    const next = fromUrl || cached;
    if (fromUrl) {
      sessionStorage.setItem("rd-portal-uid", fromUrl);
      // Keep soft query out of the durable address bar when possible.
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has(RD_UID_QUERY)) {
          // leave query for iframe navigations; sessionStorage already set
        }
      } catch {
        // ignore
      }
    }
    setUserId(next);
    setReady(true);

    function onMessage(event: MessageEvent) {
      if (!isInspectLogoutMessage(event.data)) return;
      clearRdUserData(window.localStorage, { clearAllRdKeys: true });
      sessionStorage.removeItem("rd-portal-uid");
      setUserId(null);
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return { userId, ready };
}
