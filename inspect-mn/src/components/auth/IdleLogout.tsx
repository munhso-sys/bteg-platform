"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_SESSION_SETTINGS,
  SESSION_SETTINGS_CHANGED_EVENT,
  readCachedSessionSettings,
  writeCachedSessionSettings,
  type SessionSettings,
} from "@/lib/session-settings";

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "pointerdown",
  "click",
] as const;

const CHECK_MS = 5_000;
const ACTIVITY_THROTTLE_MS = 1_000;
const SETTINGS_POLL_MS = 120_000;

function isAuthPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/access-request" ||
    pathname === "/forgot-password" ||
    pathname === "/update-password"
  );
}

function isActivityMessage(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  const type = (data as { type?: string }).type;
  return type === "inspect-activity" || type === "inspect-chrome";
}

export function IdleLogout() {
  const pathname = usePathname();
  const settingsRef = useRef<SessionSettings>(DEFAULT_SESSION_SETTINGS);
  const lastActivityRef = useRef(0);
  const loggingOutRef = useRef(false);

  useEffect(() => {
    lastActivityRef.current = Date.now();
    settingsRef.current = readCachedSessionSettings();

    let cancelled = false;

    async function loadSettings() {
      try {
        const res = await fetch("/api/settings/session", { cache: "no-store" });
        const data = await res.json();
        if (cancelled || !data.ok || !data.settings) return;
        writeCachedSessionSettings(data.settings);
        settingsRef.current = data.settings;
      } catch {
        // keep cached / default
      }
    }

    void loadSettings();
    const poll = window.setInterval(() => {
      void loadSettings();
    }, SETTINGS_POLL_MS);

    function onSettingsChange(e: Event) {
      const detail = (e as CustomEvent<SessionSettings>).detail;
      if (!detail) return;
      const prevMinutes = settingsRef.current.idleLogoutMinutes;
      settingsRef.current = detail;
      if (prevMinutes !== detail.idleLogoutMinutes) {
        lastActivityRef.current = Date.now();
      }
    }

    window.addEventListener(SESSION_SETTINGS_CHANGED_EVENT, onSettingsChange);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
      window.removeEventListener(
        SESSION_SETTINGS_CHANGED_EVENT,
        onSettingsChange,
      );
    };
  }, []);

  useEffect(() => {
    if (isAuthPath(pathname)) return;

    lastActivityRef.current = Date.now();
    let lastMark = 0;

    function markActivity() {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastMark < ACTIVITY_THROTTLE_MS) return;
      lastMark = now;
      lastActivityRef.current = now;
    }

    async function logout() {
      if (loggingOutRef.current) return;
      loggingOutRef.current = true;
      try {
        const supabase = createClient();
        await supabase.auth.signOut();
      } catch {
        // still force login redirect
      } finally {
        window.location.assign("/login?reason=idle");
      }
    }

    function checkIdle() {
      const minutes = settingsRef.current.idleLogoutMinutes;
      if (!minutes || minutes <= 0) return;
      if (Date.now() - lastActivityRef.current >= minutes * 60_000) {
        void logout();
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        markActivity();
      }
    }

    function onMessage(event: MessageEvent) {
      if (isActivityMessage(event.data)) markActivity();
    }

    function onSettingsChange(e: Event) {
      const detail = (e as CustomEvent<SessionSettings>).detail;
      if (!detail) return;
      const prevMinutes = settingsRef.current.idleLogoutMinutes;
      settingsRef.current = detail;
      if (prevMinutes !== detail.idleLogoutMinutes) {
        lastActivityRef.current = Date.now();
      }
    }

    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, markActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("message", onMessage);
    window.addEventListener(SESSION_SETTINGS_CHANGED_EVENT, onSettingsChange);

    const interval = window.setInterval(checkIdle, CHECK_MS);
    checkIdle();

    return () => {
      window.clearInterval(interval);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, markActivity);
      }
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("message", onMessage);
      window.removeEventListener(
        SESSION_SETTINGS_CHANGED_EVENT,
        onSettingsChange,
      );
    };
  }, [pathname]);

  return null;
}
