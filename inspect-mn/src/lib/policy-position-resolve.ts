import { getDutyModuleApps } from "@/lib/module-apps";

/**
 * Historical Portal → Policy cross-origin position normalize.
 * Kept only for RC1 timing proof tests. Production embed build must NOT call this.
 */
export async function resolvePositionIdViaPolicyApi(
  rawId: string | null | undefined,
  name: string | null | undefined,
  options?: { fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<{ id: string; name: string } | null> {
  if (!rawId && !name) return null;
  const fetchImpl = options?.fetchImpl ?? fetch;
  const timeoutMs = options?.timeoutMs ?? 8000;
  try {
    const origin = getDutyModuleApps()["policy-compliance"].origin;
    const url = new URL(`${origin}/api/positions/resolve`);
    if (rawId) url.searchParams.set("id", rawId);
    if (name) url.searchParams.set("name", name);
    const res = await fetchImpl(url.toString(), {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return rawId ? { id: rawId, name: name || rawId } : null;
    const data = (await res.json()) as {
      ok?: boolean;
      id?: string;
      name?: string;
    };
    if (data?.ok && data.id) {
      return { id: data.id, name: data.name || name || data.id };
    }
  } catch {
    // ignore
  }
  if (rawId) return { id: rawId, name: name || rawId };
  return null;
}

/** Profile fields are enough to mint embed claims — no remote normalize. */
export function positionFromProfile(profile: {
  position_id?: string | null;
  position_name?: string | null;
}): { id: string | null; name: string | null } {
  return {
    id: profile.position_id ?? null,
    name: profile.position_name ?? null,
  };
}
