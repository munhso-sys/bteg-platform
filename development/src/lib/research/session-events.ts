export const RD_ACCESS_TOKEN_KEY = "rd-portal-access-token";
export const RD_SESSION_READY_EVENT = "inspect-rd-session-ready";

/** Portal origins allowed to post session tokens into this iframe. */
export function allowedPortalOrigins(): string[] {
  const fromEnv = (process.env.NEXT_PUBLIC_SITE_URL || "")
    .split(",")
    .map((v) => v.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const defaults = [
    "https://bteg.inspect.mn",
    "https://platform-portal-blue.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];
  return [...new Set([...fromEnv, ...defaults])];
}

export function readStoredAccessToken(): string | null {
  try {
    const value = sessionStorage.getItem(RD_ACCESS_TOKEN_KEY)?.trim();
    return value || null;
  } catch {
    return null;
  }
}

export function storeAccessToken(token: string | null) {
  try {
    if (!token) sessionStorage.removeItem(RD_ACCESS_TOKEN_KEY);
    else sessionStorage.setItem(RD_ACCESS_TOKEN_KEY, token);
  } catch {
    // private mode / blocked storage
  }
}

/** Same-origin research API fetch with portal Bearer token when available. */
export async function researchFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers || {});
  const token = readStoredAccessToken();
  if (token && !headers.has("authorization")) {
    headers.set("authorization", `Bearer ${token}`);
  }
  return fetch(input, {
    ...init,
    headers,
    cache: init.cache ?? "no-store",
  });
}
