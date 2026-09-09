/**
 * Research & Development client persistence helpers.
 * RD-D01: local-only prototype (not multi-device).
 * RD-D02: namespace keys by portal user id; clear on logout.
 */

export const RD_PROJECTS_BASE_KEY = "rd-research-projects";
export const RD_PROGRAM_BASE_KEY = "rd-program-initiatives-v1";
export const RD_LOGOUT_MESSAGE_TYPE = "inspect-logout";
export const RD_UID_QUERY = "rd_uid";

export type RdStorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
};

export function sanitizeRdUserId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const id = String(raw).trim();
  if (!id) return null;
  // Prevent path-like / oversized garbage in keys
  if (id.length > 128) return null;
  if (!/^[A-Za-z0-9_.:@-]+$/.test(id)) return null;
  return id;
}

export function rdStorageKey(base: string, userId: string | null): string {
  const uid = sanitizeRdUserId(userId);
  if (!uid) return `${base}:anonymous`;
  return `${base}:user:${uid}`;
}

export function readRdJsonArray<T>(
  storage: RdStorageLike,
  base: string,
  userId: string | null,
): T[] | null {
  try {
    const raw = storage.getItem(rdStorageKey(base, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T[];
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeRdJsonArray<T>(
  storage: RdStorageLike,
  base: string,
  userId: string | null,
  value: T[],
): void {
  storage.setItem(rdStorageKey(base, userId), JSON.stringify(value));
}

/** Remove only pre-namespacing shared keys (RD-D02 migration). */
export function clearLegacyRdSharedKeys(storage: RdStorageLike): void {
  storage.removeItem(RD_PROJECTS_BASE_KEY);
  storage.removeItem(RD_PROGRAM_BASE_KEY);
}

/** Remove legacy shared keys and all namespaced RD keys for a user (or all RD keys on logout). */
export function clearRdUserData(
  storage: RdStorageLike,
  options?: { userId?: string | null; clearAllRdKeys?: boolean },
): void {
  clearLegacyRdSharedKeys(storage);

  if (options?.clearAllRdKeys) {
    const toRemove: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const k = storage.key(i);
      if (!k) continue;
      if (
        k === RD_PROJECTS_BASE_KEY ||
        k === RD_PROGRAM_BASE_KEY ||
        k.startsWith(`${RD_PROJECTS_BASE_KEY}:`) ||
        k.startsWith(`${RD_PROGRAM_BASE_KEY}:`)
      ) {
        toRemove.push(k);
      }
    }
    for (const k of toRemove) storage.removeItem(k);
    return;
  }

  const uid = sanitizeRdUserId(options?.userId ?? null);
  if (!uid) return;
  storage.removeItem(rdStorageKey(RD_PROJECTS_BASE_KEY, uid));
  storage.removeItem(rdStorageKey(RD_PROGRAM_BASE_KEY, uid));
}

export function resolveRdUserIdFromSearch(
  search: string | URLSearchParams,
): string | null {
  const params =
    typeof search === "string"
      ? new URLSearchParams(
          search.startsWith("?") ? search.slice(1) : search,
        )
      : search;
  return sanitizeRdUserId(params.get(RD_UID_QUERY));
}

export function isInspectLogoutMessage(data: unknown): boolean {
  if (!data || typeof data !== "object") return false;
  return (data as { type?: string }).type === RD_LOGOUT_MESSAGE_TYPE;
}
