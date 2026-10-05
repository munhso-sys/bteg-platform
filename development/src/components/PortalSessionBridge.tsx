"use client";

import { useEffect } from "react";
import { isInspectLogoutMessage } from "@/lib/rd-storage";
import {
  RD_SESSION_READY_EVENT,
  allowedPortalOrigins,
  storeAccessToken,
} from "@/lib/research/session-events";

/**
 * Accepts portal-posted Supabase session tokens and clears them on logout.
 * On mount (inside iframe) requests a session from the parent — early parent
 * postMessages are lost if this listener is not ready yet.
 */
export function PortalSessionBridge() {
  useEffect(() => {
    function requestSessionFromParent() {
      if (window.parent === window) return;
      try {
        window.parent.postMessage(
          { type: "inspect-session-request" },
          "*",
        );
      } catch {
        // ignore
      }
    }

    async function onMessage(event: MessageEvent) {
      const allowed = allowedPortalOrigins();
      if (allowed.length > 0 && !allowed.includes(event.origin)) return;

      const data = event.data as {
        type?: string;
        access_token?: string;
        refresh_token?: string;
      } | null;
      if (!data?.type) return;

      if (isInspectLogoutMessage(data)) {
        storeAccessToken(null);
        await fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined);
        window.dispatchEvent(
          new CustomEvent(RD_SESSION_READY_EVENT, { detail: { ready: false } }),
        );
        return;
      }

      if (data.type !== "inspect-session") return;
      if (!data.access_token || !data.refresh_token) return;

      storeAccessToken(data.access_token);

      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
        }),
      }).catch(() => null);

      window.dispatchEvent(
        new CustomEvent(RD_SESSION_READY_EVENT, { detail: { ready: true } }),
      );
    }

    window.addEventListener("message", onMessage);
    // Request immediately and again shortly after hydration.
    requestSessionFromParent();
    const timers = [300, 1000, 2500, 5000].map((ms) =>
      window.setTimeout(requestSessionFromParent, ms),
    );

    return () => {
      window.removeEventListener("message", onMessage);
      for (const id of timers) window.clearTimeout(id);
    };
  }, []);

  return null;
}
