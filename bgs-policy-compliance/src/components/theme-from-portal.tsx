"use client";

import { useEffect } from "react";

const THEME_KEY = "inspect-mn-theme";

function apply(mode: "light" | "dark") {
  const root = document.documentElement;
  if (mode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    // ignore
  }
}

/** Sync portal Appearance (light/night) into duty module iframes. */
export function ThemeFromPortal() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("theme");
    if (q === "dark" || q === "light") {
      apply(q);
    } else {
      try {
        const stored = localStorage.getItem(THEME_KEY);
        if (stored === "dark" || stored === "light") apply(stored);
      } catch {
        // ignore
      }
    }

    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string; theme?: string } | null;
      if (!data || data.type !== "inspect-theme") return;
      if (data.theme === "dark" || data.theme === "light") apply(data.theme);
    }

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return null;
}
