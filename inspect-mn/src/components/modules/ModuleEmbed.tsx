"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DutyModuleApp } from "@/lib/module-apps";
import { embedSrc } from "@/lib/module-apps";
import { applyTheme, readStoredTheme, type ThemeMode } from "@/lib/theme";
import { INSPECT_LOGOUT_EVENT } from "@/lib/portal-logout-broadcast";
import { createClient } from "@/lib/supabase/client";

/**
 * Embed duty module. Theme is passed once via URL, then synced with postMessage
 * (no remount / no ready-gate that can flash the "unavailable" dialog).
 */
export function ModuleEmbed({
  app,
  entryPath,
  query,
}: {
  app: DutyModuleApp;
  entryPath?: string;
  query?: Record<string, string>;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [bootTheme, setBootTheme] = useState<ThemeMode | null>(null);

  useEffect(() => {
    const initial = readStoredTheme();
    const bootId = window.setTimeout(() => {
      setTheme(initial);
      setBootTheme(initial);
    }, 0);

    function onTheme(e: Event) {
      const detail = (e as CustomEvent<{ theme?: ThemeMode }>).detail;
      const next =
        detail?.theme === "dark" || detail?.theme === "light"
          ? detail.theme
          : readStoredTheme();
      setTheme(next);
      try {
        iframeRef.current?.contentWindow?.postMessage(
          { type: "inspect-theme", theme: next },
          app.origin,
        );
      } catch {
        // ignore
      }
    }

    function onMessage(event: MessageEvent) {
      if (event.origin !== app.origin) return;
      const data = event.data as { type?: string; theme?: string } | null;
      if (!data || data.type !== "inspect-theme") return;
      if (data.theme !== "dark" && data.theme !== "light") return;
      applyTheme(data.theme);
      setTheme(data.theme);
    }

    function onPortalLogout() {
      try {
        iframeRef.current?.contentWindow?.postMessage(
          { type: "inspect-logout" },
          app.origin,
        );
      } catch {
        // ignore
      }
    }

    window.addEventListener("inspect-theme-change", onTheme);
    window.addEventListener("message", onMessage);
    window.addEventListener(INSPECT_LOGOUT_EVENT, onPortalLogout);
    return () => {
      window.clearTimeout(bootId);
      window.removeEventListener("inspect-theme-change", onTheme);
      window.removeEventListener("message", onMessage);
      window.removeEventListener(INSPECT_LOGOUT_EVENT, onPortalLogout);
    };
  }, [app.origin]);

  const postTheme = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "inspect-theme", theme },
        app.origin,
      );
    } catch {
      // ignore
    }
  }, [app.origin, theme]);

  const postSession = useCallback(async () => {
    if (app.id !== "development") return;
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session?.access_token || !session.refresh_token) return;
      iframeRef.current?.contentWindow?.postMessage(
        {
          type: "inspect-session",
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        },
        app.origin,
      );
    } catch {
      // ignore
    }
  }, [app.id, app.origin]);

  if (!bootTheme) {
    return (
      <div className="flex h-full min-h-[70vh] items-center justify-center text-sm text-[var(--muted)]">
        Ачаалж байна…
      </div>
    );
  }

  const src = embedSrc(app, bootTheme, { entryPath, query });

  return (
    <iframe
      ref={iframeRef}
      title={app.label}
      src={src}
      className="h-full w-full flex-1 border-0 bg-[var(--card)]"
      allow="clipboard-read; clipboard-write"
      onLoad={() => {
        postTheme();
        void postSession();
      }}
    />
  );
}
