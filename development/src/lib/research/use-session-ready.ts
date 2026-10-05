"use client";

import { useEffect, useState } from "react";
import {
  RD_SESSION_READY_EVENT,
  readStoredAccessToken,
  researchFetch,
} from "./session-events";

/**
 * Wait until portal iframe posted a session (Bearer and/or cookies).
 * Late session messages clear a previous timeout failure.
 */
export function useResearchSessionReady(timeoutMs = 15_000) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    async function probe() {
      if (readStoredAccessToken()) {
        if (!cancelled) {
          setReady(true);
          setFailed(false);
        }
        return true;
      }
      try {
        const res = await researchFetch("/api/auth/session");
        const body = (await res.json().catch(() => null)) as {
          ok?: boolean;
          authenticated?: boolean;
        } | null;
        if (!cancelled && res.ok && body?.ok && body.authenticated) {
          setReady(true);
          setFailed(false);
          return true;
        }
      } catch {
        // keep polling
      }
      return false;
    }

    function onReady(event: Event) {
      const detail = (event as CustomEvent<{ ready?: boolean }>).detail;
      if (cancelled) return;
      if (detail?.ready) {
        setReady(true);
        setFailed(false);
      } else {
        setReady(false);
      }
    }

    window.addEventListener(RD_SESSION_READY_EVENT, onReady);

    void (async () => {
      if (await probe()) return;
      const started = Date.now();
      while (!cancelled && Date.now() - started < timeoutMs) {
        attempts += 1;
        await new Promise((r) => window.setTimeout(r, attempts < 4 ? 250 : 500));
        if (await probe()) return;
      }
      if (cancelled) return;
      if (readStoredAccessToken()) {
        setReady(true);
        setFailed(false);
      } else {
        setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      window.removeEventListener(RD_SESSION_READY_EVENT, onReady);
    };
  }, [timeoutMs]);

  return { ready, sessionReady: ready, failed };
}
