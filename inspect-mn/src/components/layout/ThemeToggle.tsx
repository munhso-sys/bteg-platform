"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import {
  applyTheme,
  readStoredTheme,
  type ThemeMode,
} from "@/lib/theme";
import { cn } from "@/lib/cn";

export function ThemeToggle({
  className,
  compact = false,
}: {
  className?: string;
  /** Icon-only button for dense headers */
  compact?: boolean;
}) {
  // Always start with a stable SSR/client default to avoid hydration mismatch.
  // Sync from localStorage only after mount.
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = readStoredTheme();
    setTheme(stored);
    setReady(true);

    function onTheme(e: Event) {
      const detail = (e as CustomEvent<{ theme?: ThemeMode }>).detail;
      if (detail?.theme === "dark" || detail?.theme === "light") {
        setTheme(detail.theme);
      }
    }
    window.addEventListener("inspect-theme-change", onTheme);
    return () => window.removeEventListener("inspect-theme-change", onTheme);
  }, []);

  function toggle() {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <button
      type="button"
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md text-[var(--fg)] hover:bg-[var(--surface-muted)]",
        compact ? "p-2" : "px-2.5 py-2 text-xs",
        !ready && "invisible",
        className,
      )}
      onClick={toggle}
      title={theme === "dark" ? "Light горим" : "Night горим"}
      aria-label="Appearance"
      suppressHydrationWarning
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      {compact ? null : (
        <span className="hidden sm:inline">
          {theme === "dark" ? "Night" : "Light"}
        </span>
      )}
    </button>
  );
}
