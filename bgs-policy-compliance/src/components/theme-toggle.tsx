"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

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
  try {
    window.parent?.postMessage({ type: "inspect-theme", theme: mode }, "*");
  } catch {
    // ignore
  }
}

function read(): "light" | "dark" {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "dark" || v === "light") return v;
  } catch {
    // ignore
  }
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function readClientTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return read();
}

/** Appearance control for duty-module headers (syncs with portal). */
export function ThemeToggleButton({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useState<"light" | "dark">(readClientTheme);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as { type?: string; theme?: string } | null;
      if (!data || data.type !== "inspect-theme") return;
      if (data.theme === "dark" || data.theme === "light") {
        setTheme(data.theme);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    apply(next);
  }

  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1.5 rounded-md border border-[var(--border)] px-2 py-1.5 text-xs text-[var(--fg)] hover:bg-slate-50 dark:hover:bg-white/5 ${className}`}
      onClick={toggle}
      title={theme === "dark" ? "Light горим" : "Night горим"}
      aria-label="Appearance"
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      <span className="hidden sm:inline">
        {theme === "dark" ? "Night" : "Light"}
      </span>
    </button>
  );
}
