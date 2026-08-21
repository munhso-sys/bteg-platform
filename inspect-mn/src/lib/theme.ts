export type ThemeMode = "light" | "dark";

export const THEME_KEY = "inspect-mn-theme";

export function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (mode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(
      new CustomEvent("inspect-theme-change", { detail: { theme: mode } }),
    );
  } catch {
    // ignore
  }
}

export function readStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "dark" || v === "light") return v;
  } catch {
    // ignore
  }
  return "light";
}
