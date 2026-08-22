import { readDb } from "@/lib/db/local-store";
import type { JobPosition } from "@/lib/types";

function normalizePositionKey(value: string) {
  return value
    .toLowerCase()
    .replace(/[·•]/g, " ")
    .replace(/[_/]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .trim();
}

function matchPosition(
  positions: JobPosition[],
  raw: string,
): JobPosition | null {
  const exact = positions.find((p) => p.id === raw);
  if (exact) return exact;

  const code = raw.startsWith("code:") ? raw.slice(5) : raw;
  const needle = normalizePositionKey(code);
  if (!needle) return null;

  const byName = positions.find(
    (p) => normalizePositionKey(p.name) === needle,
  );
  if (byName) return byName;

  const byOfficial = positions.find(
    (p) => (p.official_code ?? "") === code,
  );
  if (byOfficial) return byOfficial;

  const byBteg = positions.find((p) => (p.bteg_id ?? "") === code);
  if (byBteg) return byBteg;

  // Loose contains for labels like "Операторч · Бульдозерын · Гинжит"
  const loose = positions.find((p) => {
    const n = normalizePositionKey(p.name);
    return n.includes(needle) || needle.includes(n);
  });
  return loose ?? null;
}

/** Map portal access-request ids (`code:Name` or UUID) to real job_positions.id */
export async function resolveJobPositionRef(
  rawId?: string | null,
  hintName?: string | null,
): Promise<{ id: string; name: string } | null> {
  const db = await readDb();
  const positions = db.job_positions.filter((p) => p.is_active);
  if (!positions.length) return null;

  if (rawId?.trim()) {
    const hit = matchPosition(positions, rawId.trim());
    if (hit) return { id: hit.id, name: hit.name };
  }
  if (hintName?.trim()) {
    const hit = matchPosition(positions, hintName.trim());
    if (hit) return { id: hit.id, name: hit.name };
  }
  return null;
}
