"use client";

/** Must match INSPECTION_EMBED_HEADER in @/lib/access/embed */
const INSPECTION_EMBED_HEADER = "x-inspection-embed";
const STORAGE_KEY = "inspection_embed_token";

/** Read portal-signed embed token kept for iframe client navigations. */
export function getClientEmbedToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const fromUrl = new URL(window.location.href).searchParams.get("embed");
    if (fromUrl) {
      sessionStorage.setItem(STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * fetch() for IC APIs that need write scope inside portal iframe.
 * Middleware skips /api, and 3P cookies are often blocked — send embed header.
 */
export async function inspectionApiFetch(
  input: string,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getClientEmbedToken();
  if (token && !headers.has(INSPECTION_EMBED_HEADER)) {
    headers.set(INSPECTION_EMBED_HEADER, token);
  }
  return fetch(input, {
    ...init,
    headers,
    credentials: init.credentials ?? "include",
  });
}
