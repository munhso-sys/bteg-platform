/**
 * Portal hosts this app under `/policy-compliance` but proxies to the
 * deployment root (no Next `basePath`). Prefix browser API/export URLs only
 * when the page is actually under that portal path.
 */
export function getBasePath(): string {
  if (typeof window === "undefined") return "";
  const known = "/policy-compliance";
  const path = window.location.pathname;
  if (path === known || path.startsWith(`${known}/`)) return known;
  return "";
}

/** Prefix an absolute app path (`/api/...`) for portal subpath hosting. */
export function withBasePath(path: string): string {
  const base = getBasePath();
  if (!path.startsWith("/")) return `${base}/${path}`;
  return `${base}${path}`;
}
