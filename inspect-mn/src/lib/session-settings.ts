export const SESSION_SETTINGS_KEY = "platform_session_settings";
export const SESSION_SETTINGS_CACHE_KEY = "inspect-mn-session-settings";
export const SESSION_SETTINGS_CHANGED_EVENT = "inspect-session-settings-change";

export type SessionSettings = {
  /** Minutes of inactivity before auto logout. 0 = disabled. */
  idleLogoutMinutes: number;
};

export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  idleLogoutMinutes: 30,
};

export const IDLE_LOGOUT_PRESETS = [5, 10, 15, 30, 60, 120] as const;

export function clampIdleLogoutMinutes(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(480, Math.max(1, Math.round(n)));
}

export function normalizeSessionSettings(
  raw: unknown,
): SessionSettings {
  const obj =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    idleLogoutMinutes: clampIdleLogoutMinutes(obj.idleLogoutMinutes),
  };
}

export function readCachedSessionSettings(): SessionSettings {
  if (typeof window === "undefined") return DEFAULT_SESSION_SETTINGS;
  try {
    const raw = localStorage.getItem(SESSION_SETTINGS_CACHE_KEY);
    if (!raw) return DEFAULT_SESSION_SETTINGS;
    return normalizeSessionSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SESSION_SETTINGS;
  }
}

export function writeCachedSessionSettings(settings: SessionSettings) {
  if (typeof window === "undefined") return;
  const next = normalizeSessionSettings(settings);
  try {
    const prevRaw = localStorage.getItem(SESSION_SETTINGS_CACHE_KEY);
    if (prevRaw) {
      try {
        const prev = normalizeSessionSettings(JSON.parse(prevRaw));
        if (prev.idleLogoutMinutes === next.idleLogoutMinutes) {
          return;
        }
      } catch {
        // rewrite below
      }
    }
    localStorage.setItem(SESSION_SETTINGS_CACHE_KEY, JSON.stringify(next));
    window.dispatchEvent(
      new CustomEvent(SESSION_SETTINGS_CHANGED_EVENT, { detail: next }),
    );
  } catch {
    // ignore
  }
}
