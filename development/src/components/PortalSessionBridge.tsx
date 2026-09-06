"use client";

import { useEffect } from "react";
import { isInspectLogoutMessage } from "@/lib/rd-storage";

/**
 * Accepts portal-posted Supabase session tokens and clears them on logout.
 * rd_uid / localStorage are never used for authorization.
 */
export function PortalSessionBridge() {
  useEffect(() => {
    async function onMessage(event: MessageEvent) {
      const data = event.data as {
        type?: string;
        access_token?: string;
        refresh_token?: string;
      } | null;
      if (!data?.type) return;

      if (isInspectLogoutMessage(data)) {
        await fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined);
        return;
      }

      if (data.type !== "inspect-session") return;
      if (!data.access_token || !data.refresh_token) return;

      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        }),
      }).catch(() => undefined);
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return null;
}
