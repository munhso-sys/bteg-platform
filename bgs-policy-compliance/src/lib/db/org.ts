import { promises as fs } from "fs";
import path from "path";
import { avg } from "@/lib/utils";
import { getLocalDataDir, isReadOnlyFsError } from "@/lib/db/data-paths";
import { ensureDataDir, updateDb } from "@/lib/db/local-store";
import {
  loadRemotePayload,
  preferRemoteStore,
  REMOTE_KEYS,
  saveRemotePayload,
} from "@/lib/db/remote-store";
import {
  evaluationsWithActiveLinks,
  getDb,
  latestEvaluations,
} from "@/lib/db/repository";
import type { JobDescription, JobPosition, Policy } from "@/lib/types";
import {
  DIRECT_ALBA_ID,
  COMPANY_ALBA_ID,
  COMPANY_HELTES_ID,
  COMPANY_SCOPE_LABEL,
  HELTES_COMMON_LABEL,
  OTHER_ALBA_ID,
  OTHER_HELTES_ID,
  type OrgAssignTree,
  type OrgExplorerHeltes,
  type PositionListRow,
} from "@/lib/org-assign";

export {
  DIRECT_ALBA_ID,
  COMPANY_ALBA_ID,
  COMPANY_HELTES_ID,
  COMPANY_SCOPE_LABEL,
  HELTES_COMMON_LABEL,
  OTHER_ALBA_ID,
  OTHER_HELTES_ID,
  orgPath,
  type OrgAssignTree,
  type OrgExplorerHeltes,
  type PositionListRow,
} from "@/lib/org-assign";

type RefAlba = {
  id: string;
  name: string;
  code: string;
  heltes_id: string;
  position_codes: string[];
  policy_titles: string[];
};

type RefHeltes = {
  id: string;
  name: string;
  code: string;
  albas: RefAlba[];
  policy_titles: string[];
};

type OrgCatalog = {
  heltes: RefHeltes[];
  other: { id: string; name: string };
};

type OrgRef = { type: "heltes" | "alba" | "company"; id: string };

type ReferenceMap = {
  built_at?: string;
  position_to_alba: Record<string, string>;
  policy_to_org: Record<string, OrgRef[]>;
  unmatched_positions: Array<{ id: string; name: string }>;
  unmatched_policies: Array<{ id: string; name: string }>;
  stats?: Record<string, number>;
};

function policyOrgs(
  map: ReferenceMap,
): Array<{ pid: string; type: "heltes" | "alba" | "company"; id: string }> {
  const out: Array<{ pid: string; type: "heltes" | "alba" | "company"; id: string }> = [];
  for (const [pid, orgs] of Object.entries(map.policy_to_org)) {
    const list = Array.isArray(orgs) ? orgs : [orgs];
    for (const org of list) out.push({ pid, type: org.type, id: org.id });
  }
  return out;
}

export type OrgHeltesSummary = {
  bteg_id: string;
  bteg_ids: string[];
  name: string;
  alba_count: number;
  position_count: number;
  policy_count: number;
  avg_score: number | null;
};

export type OrgAlbaSummary = {
  bteg_id: string;
  bteg_ids: string[];
  name: string;
  heltes_id: string;
  heltes_name: string;
  position_count: number;
  policy_count: number;
  avg_score: number | null;
  is_direct: boolean;
};

type OrgCatalogOverridesFile = {
  heltes?: RefHeltes[];
  removed_heltes_ids?: string[];
  removed_alba_ids?: string[];
};

async function loadCatalogOverrides(): Promise<OrgCatalogOverridesFile> {
  if (preferRemoteStore()) {
    const remote = await loadRemotePayload<OrgCatalogOverridesFile>(
      REMOTE_KEYS.orgCatalogOverrides,
    );
    if (remote) return remote;
  }
  try {
    const p = path.join(getLocalDataDir(), "org-catalog-overrides.json");
    return JSON.parse(await fs.readFile(p, "utf8")) as OrgCatalogOverridesFile;
  } catch {
    return {};
  }
}

async function saveCatalogOverrides(overrides: OrgCatalogOverridesFile) {
  if (preferRemoteStore()) {
    const ok = await saveRemotePayload(
      REMOTE_KEYS.orgCatalogOverrides,
      overrides,
    );
    if (!ok) throw new Error("Org catalog override хадгалж чадсангүй");
    return;
  }
  await ensureDataDir();
  const p = path.join(getLocalDataDir(), "org-catalog-overrides.json");
  const tmp = `${p}.${process.pid}.tmp`;
  try {
    await fs.writeFile(tmp, JSON.stringify(overrides, null, 2), "utf8");
    await fs.copyFile(tmp, p);
  } finally {
    await fs.unlink(tmp).catch(() => undefined);
  }
}

function applyCatalogOverrides(
  base: OrgCatalog,
  ov: OrgCatalogOverridesFile,
): OrgCatalog {
  const removedH = new Set(ov.removed_heltes_ids ?? []);
  const removedA = new Set(ov.removed_alba_ids ?? []);
  const byId = new Map(
    base.heltes
      .filter((h) => !removedH.has(h.id))
      .map((h) => [
        h.id,
        {
          ...h,
          albas: h.albas.filter((a) => !removedA.has(a.id)),
        },
      ]),
  );
  for (const h of ov.heltes ?? []) {
    if (removedH.has(h.id)) continue;
    const existing = byId.get(h.id);
    if (!existing) {
      byId.set(h.id, {
        ...h,
        albas: (h.albas ?? []).filter((a) => !removedA.has(a.id)),
      });
      continue;
    }
    const albaById = new Map(existing.albas.map((a) => [a.id, a]));
    for (const a of h.albas ?? []) {
      if (removedA.has(a.id)) continue;
      albaById.set(a.id, a);
    }
    byId.set(h.id, {
      ...existing,
      name: h.name || existing.name,
      code: h.code || existing.code,
      policy_titles: h.policy_titles ?? existing.policy_titles,
      albas: [...albaById.values()],
    });
  }
  return {
    other: base.other,
    heltes: [...byId.values()].sort((a, b) =>
      a.name.localeCompare(b.name, "mn"),
    ),
  };
}

async function loadCatalog(): Promise<OrgCatalog> {
  const p = path.join(process.cwd(), "data", "reference", "org-catalog.json");
  const raw = JSON.parse(await fs.readFile(p, "utf8")) as OrgCatalog;
  // Known naming corrections (spreadsheet / import typos)
  for (const h of raw.heltes) {
    if (h.name === "Дотоод хяналтын хэлтэс") {
      h.name = "Дотоод хяналт шалгалтын хэлтэс";
      h.code = "Дотоод_хяналт_шалгалтын_хэлтэс";
    }
    for (const a of h.albas) {
      if (a.name === "Дотоод хяналтын хэлтэс") {
        a.name = "Дотоод хяналт шалгалтын хэлтэс";
      }
    }
  }
  const overrides = await loadCatalogOverrides();
  return applyCatalogOverrides(raw, overrides);
}

async function saveCatalog(catalog: OrgCatalog) {
  // Persist additive/rename state via overrides (works on Vercel + local).
  const basePath = path.join(
    process.cwd(),
    "data",
    "reference",
    "org-catalog.json",
  );
  const base = JSON.parse(await fs.readFile(basePath, "utf8")) as OrgCatalog;
  const baseHeltesIds = new Set(base.heltes.map((h) => h.id));
  const baseAlbaIds = new Set(
    base.heltes.flatMap((h) => h.albas.map((a) => a.id)),
  );
  const nextHeltesIds = new Set(catalog.heltes.map((h) => h.id));
  const nextAlbaIds = new Set(
    catalog.heltes.flatMap((h) => h.albas.map((a) => a.id)),
  );

  const overrides: OrgCatalogOverridesFile = {
    heltes: catalog.heltes.map((h) => ({
      ...h,
      albas: h.albas.map((a) => ({ ...a, heltes_id: h.id })),
    })),
    removed_heltes_ids: [...baseHeltesIds].filter((id) => !nextHeltesIds.has(id)),
    removed_alba_ids: [...baseAlbaIds].filter((id) => !nextAlbaIds.has(id)),
  };
  await saveCatalogOverrides(overrides);

  // Best-effort local seed update when FS is writable
  if (!process.env.VERCEL) {
    const tmp = `${basePath}.${process.pid}.tmp`;
    try {
      await fs.writeFile(tmp, JSON.stringify(catalog, null, 2), "utf8");
      await fs.copyFile(tmp, basePath);
    } catch (err) {
      if (!isReadOnlyFsError(err)) throw err;
    } finally {
      await fs.unlink(tmp).catch(() => undefined);
    }
  }
}

/** Sole alba that is really the хэлтэс itself (not a separate office). */
export function isSoleHeltesLikeAlba(
  heltesAlbaCount: number,
  heltesName: string,
  albaName: string,
): boolean {
  if (heltesAlbaCount !== 1) return false;
  const n = albaName.toLocaleLowerCase("mn");
  if (albaName.trim() === heltesName.trim()) return true;
  return n.includes("хэлтэс") && !n.includes("алба");
}

function mapPath() {
  return path.join(getLocalDataDir(), "reference-map.json");
}
function overridesPath() {
  return path.join(getLocalDataDir(), "policy-org-overrides.json");
}
function positionOverridesPath() {
  return path.join(getLocalDataDir(), "position-org-overrides.json");
}

type PolicyOrgOverride = {
  orgs: Array<OrgRef> | null;
  policy_name?: string;
};

type PolicyOrgOverridesFile = Record<string, PolicyOrgOverride>;

async function loadOverrides(): Promise<PolicyOrgOverridesFile> {
  if (preferRemoteStore()) {
    const remote = await loadRemotePayload<PolicyOrgOverridesFile>(
      REMOTE_KEYS.policyOrgOverrides,
    );
    if (remote && typeof remote === "object") return remote;
  }
  await ensureDataDir();
  try {
    return JSON.parse(
      await fs.readFile(overridesPath(), "utf8"),
    ) as PolicyOrgOverridesFile;
  } catch {
    return {};
  }
}

async function saveOverrides(overrides: PolicyOrgOverridesFile) {
  if (preferRemoteStore()) {
    const ok = await saveRemotePayload(
      REMOTE_KEYS.policyOrgOverrides,
      overrides,
    );
    if (!ok) {
      throw new Error("Supabase дээр хадгалж чадсангүй (policy org overrides)");
    }
    return;
  }
  await ensureDataDir();
  const p = overridesPath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(overrides, null, 2), "utf8");
}

function applyPolicyOrgOverrides(
  map: ReferenceMap,
  overrides: PolicyOrgOverridesFile,
): ReferenceMap {
  const unmatched = [...(map.unmatched_policies ?? [])];
  const policy_to_org = { ...(map.policy_to_org ?? {}) };

  for (const [policyId, ov] of Object.entries(overrides)) {
    if (ov.orgs == null) {
      delete policy_to_org[policyId];
      if (!unmatched.some((p) => p.id === policyId)) {
        unmatched.push({
          id: policyId,
          name: ov.policy_name ?? policyId,
        });
      }
    } else {
      policy_to_org[policyId] = ov.orgs;
      const idx = unmatched.findIndex((p) => p.id === policyId);
      if (idx >= 0) unmatched.splice(idx, 1);
    }
  }

  return { ...map, policy_to_org, unmatched_policies: unmatched };
}

type PositionOrgOverride = {
  organization_name?: string | null;
  heltes_id: string;
  alba_id: string;
  position_name?: string;
};

type PositionOrgOverridesFile = Record<string, PositionOrgOverride>;

async function loadPositionOverrides(): Promise<PositionOrgOverridesFile> {
  if (preferRemoteStore()) {
    const remote = await loadRemotePayload<PositionOrgOverridesFile>(
      REMOTE_KEYS.positionOrgOverrides,
    );
    if (remote && typeof remote === "object") return remote;
  }
  await ensureDataDir();
  try {
    return JSON.parse(
      await fs.readFile(positionOverridesPath(), "utf8"),
    ) as PositionOrgOverridesFile;
  } catch {
    return {};
  }
}

async function savePositionOverrides(overrides: PositionOrgOverridesFile) {
  if (preferRemoteStore()) {
    const ok = await saveRemotePayload(
      REMOTE_KEYS.positionOrgOverrides,
      overrides,
    );
    if (!ok) {
      throw new Error(
        "Supabase дээр хадгалж чадсангүй (position org overrides)",
      );
    }
    return;
  }
  await ensureDataDir();
  const p = positionOverridesPath();
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, JSON.stringify(overrides, null, 2), "utf8");
}

/** Admin data-reset helpers */
export async function loadPolicyOrgOverridesForExport() {
  return loadOverrides();
}

export async function loadPositionOrgOverridesForExport() {
  return loadPositionOverrides();
}

export async function countPolicyOrgOverrides() {
  return Object.keys(await loadOverrides()).length;
}

export async function countPositionOrgOverrides() {
  return Object.keys(await loadPositionOverrides()).length;
}

export async function clearAllPolicyOrgOverrides() {
  await saveOverrides({});
}

export async function clearAllPositionOrgOverrides() {
  await savePositionOverrides({});
}

function applyPositionOrgOverrides(
  map: ReferenceMap,
  overrides: PositionOrgOverridesFile,
): ReferenceMap {
  const position_to_alba = { ...(map.position_to_alba ?? {}) };
  const unmatched = [...(map.unmatched_positions ?? [])];

  for (const [positionId, ov] of Object.entries(overrides)) {
    if (ov.heltes_id === OTHER_HELTES_ID || ov.alba_id === OTHER_ALBA_ID) {
      delete position_to_alba[positionId];
      if (!unmatched.some((p) => p.id === positionId)) {
        unmatched.push({
          id: positionId,
          name: ov.position_name ?? positionId,
        });
      }
    } else {
      position_to_alba[positionId] = ov.alba_id;
      const idx = unmatched.findIndex((p) => p.id === positionId);
      if (idx >= 0) unmatched.splice(idx, 1);
    }
  }

  return { ...map, position_to_alba, unmatched_positions: unmatched };
}

async function loadMap(): Promise<ReferenceMap> {
  await ensureDataDir();
  try {
    const raw = JSON.parse(
      await fs.readFile(mapPath(), "utf8"),
    ) as ReferenceMap;
    const [policyOverrides, positionOverrides] = await Promise.all([
      loadOverrides(),
      loadPositionOverrides(),
    ]);
    return applyPositionOrgOverrides(
      applyPolicyOrgOverrides(raw, policyOverrides),
      positionOverrides,
    );
  } catch {
    return {
      position_to_alba: {},
      policy_to_org: {},
      unmatched_positions: [],
      unmatched_policies: [],
    };
  }
}

async function saveMap(map: ReferenceMap) {
  await ensureDataDir();
  const file = mapPath();
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = path.join(
    path.dirname(file),
    `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`,
  );
  try {
    await fs.writeFile(tmp, JSON.stringify(map, null, 2), "utf8");
    await fs.copyFile(tmp, file);
  } catch (err) {
    if (isReadOnlyFsError(err)) {
      throw new Error(
        "Production сервер дээр файлд хадгалах боломжгүй. Өөрчлөлт түр хадгалагдана; бүрэн хадгалалтад Supabase холбох хэрэгтэй.",
      );
    }
    throw err;
  } finally {
    await fs.unlink(tmp).catch(() => undefined);
  }
}

function scoreMaps(db: Awaited<ReturnType<typeof getDb>>) {
  // Soft-unlinked responsibilities keep historical evaluations; scores must
  // only reflect currently active clause↔position links.
  const latest = latestEvaluations(
    evaluationsWithActiveLinks(
      db.compliance_evaluations,
      db.clause_position_responsibilities,
    ),
  );
  const clauseToPolicy = new Map(
    db.policy_clauses.map((c) => [c.id, c.policy_id] as const),
  );
  const byPolicy = new Map<string, number[]>();
  const byPosition = new Map<string, number[]>();
  for (const e of latest) {
    const pid = clauseToPolicy.get(e.policy_clause_id);
    if (pid) {
      const list = byPolicy.get(pid) ?? [];
      list.push(e.score);
      byPolicy.set(pid, list);
    }
    const plist = byPosition.get(e.job_position_id) ?? [];
    plist.push(e.score);
    byPosition.set(e.job_position_id, plist);
  }
  return { latest, byPolicy, byPosition, clauseToPolicy };
}

function avgFromIds(
  ids: Iterable<string>,
  scoreMap: Map<string, number[]>,
): number | null {
  const scores: number[] = [];
  for (const id of ids) {
    const s = scoreMap.get(id);
    if (s?.length) scores.push(...s);
  }
  return avg(scores);
}

export async function listHeltes(): Promise<OrgHeltesSummary[]> {
  const [catalog, map, db] = await Promise.all([
    loadCatalog(),
    loadMap(),
    getDb(),
  ]);
  const { byPolicy, byPosition } = scoreMaps(db);

  const rows: OrgHeltesSummary[] = catalog.heltes.map((h) => {
    const albaIds = new Set(h.albas.map((a) => a.id));
    const positionIds = Object.entries(map.position_to_alba)
      .filter(([, albaId]) => albaIds.has(albaId))
      .map(([pid]) => pid);

    const policyIds = new Set<string>();
    for (const org of policyOrgs(map)) {
      if (org.type === "heltes" && org.id === h.id) policyIds.add(org.pid);
      if (org.type === "alba" && albaIds.has(org.id)) policyIds.add(org.pid);
    }

    return {
      bteg_id: h.id,
      bteg_ids: [h.id],
      name: h.name,
      alba_count: h.albas.length,
      position_count: positionIds.length,
      policy_count: policyIds.size,
      avg_score: avg([
        avgFromIds(policyIds, byPolicy),
        avgFromIds(positionIds, byPosition),
      ].filter((x): x is number => x != null)),
    };
  });

  // Бусад
  const otherPos = map.unmatched_positions.map((p) => p.id);
  const otherPol = map.unmatched_policies.map((p) => p.id);
  if (otherPos.length || otherPol.length) {
    rows.push({
      bteg_id: OTHER_HELTES_ID,
      bteg_ids: [OTHER_HELTES_ID],
      name: catalog.other.name,
      alba_count: 1,
      position_count: otherPos.length,
      policy_count: otherPol.length,
      avg_score: avg([
        avgFromIds(otherPol, byPolicy),
        avgFromIds(otherPos, byPosition),
      ].filter((x): x is number => x != null)),
    });
  }

  return rows.sort((a, b) => {
    if (a.bteg_id === OTHER_HELTES_ID) return 1;
    if (b.bteg_id === OTHER_HELTES_ID) return -1;
    return a.name.localeCompare(b.name, "mn");
  });
}

export type OrgUnitComplianceRow = {
  id: string;
  kind: "heltes" | "alba";
  name: string;
  heltesName: string | null;
  avg: number | null;
  evaluationCount: number;
  relatedPolicyCount: number;
  evaluatedPolicyCount: number;
  policies: Array<{
    id: string;
    name: string;
    reference_code: string | null;
    evaluated: boolean;
  }>;
};

/** Бүх хэлтэс + алба — журмын биелэлт/үнэлгээний дундаж */
export async function listOrgUnitComplianceRows(): Promise<OrgUnitComplianceRow[]> {
  const [catalog, map, db] = await Promise.all([
    loadCatalog(),
    loadMap(),
    getDb(),
  ]);
  const { latest, byPolicy, byPosition, clauseToPolicy } = scoreMaps(db);
  const policyById = new Map(
    db.policies.filter((p) => !p.is_deleted).map((p) => [p.id, p]),
  );

  const evalsByPosition = new Map<string, typeof latest>();
  for (const e of latest) {
    const list = evalsByPosition.get(e.job_position_id) ?? [];
    list.push(e);
    evalsByPosition.set(e.job_position_id, list);
  }

  function unitStats(positionIds: string[], policyIds: Set<string>) {
    const scores: number[] = [];
    const evaluatedPolicies = new Set<string>();
    let evaluationCount = 0;
    for (const pid of positionIds) {
      const evals = evalsByPosition.get(pid);
      if (!evals) continue;
      evaluationCount += evals.length;
      for (const e of evals) {
        scores.push(e.score);
        const policyId = clauseToPolicy.get(e.policy_clause_id);
        if (policyId) evaluatedPolicies.add(policyId);
      }
    }
    const avgScore =
      avg(scores) ??
      avg([
        avgFromIds(policyIds, byPolicy),
        avgFromIds(positionIds, byPosition),
      ].filter((x): x is number => x != null));

    const allPolicyIds = new Set([...policyIds, ...evaluatedPolicies]);
    const policies = [...allPolicyIds]
      .map((id) => {
        const p = policyById.get(id);
        if (!p) return null;
        return {
          id: p.id,
          name: p.name,
          reference_code: p.reference_code,
          evaluated: evaluatedPolicies.has(id),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x != null)
      .sort((a, b) => a.name.localeCompare(b.name, "mn"));

    return {
      avg: avgScore,
      evaluationCount,
      relatedPolicyCount: policyIds.size,
      evaluatedPolicyCount: evaluatedPolicies.size,
      policies,
    };
  }

  const rows: OrgUnitComplianceRow[] = [];

  for (const h of catalog.heltes) {
    const albaIds = new Set(h.albas.map((a) => a.id));
    const heltesPositionIds = Object.entries(map.position_to_alba)
      .filter(([, albaId]) => albaIds.has(albaId))
      .map(([pid]) => pid);

    const heltesPolicyIds = new Set<string>();
    for (const org of policyOrgs(map)) {
      if (org.type === "heltes" && org.id === h.id) heltesPolicyIds.add(org.pid);
      if (org.type === "alba" && albaIds.has(org.id)) heltesPolicyIds.add(org.pid);
    }

    const heltesStats = unitStats(heltesPositionIds, heltesPolicyIds);
    rows.push({
      id: `heltes:${h.id}`,
      kind: "heltes",
      name: h.name,
      heltesName: null,
      ...heltesStats,
    });

    for (const a of h.albas) {
      // Ганц «хэлтэс» нэртэй алба = хэлтэсийн өөрөө — Алба гэж давхардахгүй
      if (isSoleHeltesLikeAlba(h.albas.length, h.name, a.name)) continue;

      const albaPositionIds = Object.entries(map.position_to_alba)
        .filter(([, albaId]) => albaId === a.id)
        .map(([pid]) => pid);
      const albaPolicyIds = new Set<string>();
      for (const org of policyOrgs(map)) {
        if (org.type === "alba" && org.id === a.id) albaPolicyIds.add(org.pid);
      }
      if (h.albas.length === 1) {
        for (const org of policyOrgs(map)) {
          if (org.type === "heltes" && org.id === h.id) albaPolicyIds.add(org.pid);
        }
      }
      const albaStats = unitStats(albaPositionIds, albaPolicyIds);
      rows.push({
        id: `alba:${a.id}`,
        kind: "alba",
        name: a.name,
        heltesName: h.name,
        ...albaStats,
      });
    }
  }

  const otherPos = map.unmatched_positions.map((p) => p.id);
  const otherPol = new Set(map.unmatched_policies.map((p) => p.id));
  if (otherPos.length || otherPol.size) {
    const otherStats = unitStats(otherPos, otherPol);
    rows.push({
      id: `heltes:${OTHER_HELTES_ID}`,
      kind: "heltes",
      name: catalog.other.name,
      heltesName: null,
      ...otherStats,
    });
  }

  return rows.sort((a, b) => {
    const aAvg = a.avg ?? Number.POSITIVE_INFINITY;
    const bAvg = b.avg ?? Number.POSITIVE_INFINITY;
    if (aAvg !== bAvg) return aAvg - bAvg;
    if (a.kind !== b.kind) return a.kind === "heltes" ? -1 : 1;
    return a.name.localeCompare(b.name, "mn");
  });
}

export type OrgUnitRegistryRow = {
  id: string;
  kind: "heltes" | "alba";
  name: string;
  code: string;
  heltesId: string | null;
  heltesName: string | null;
  albaCount: number;
  positionCount: number;
  policyCount: number;
};

/** Алба/хэлтэсийн бүртгэлийн жагсаалт (засах хуудас) */
export async function listOrgUnitRegistry(): Promise<OrgUnitRegistryRow[]> {
  const [catalog, map] = await Promise.all([loadCatalog(), loadMap()]);
  const rows: OrgUnitRegistryRow[] = [];

  for (const h of catalog.heltes) {
    const albaIds = new Set(h.albas.map((a) => a.id));
    const heltesPos = Object.entries(map.position_to_alba).filter(([, id]) =>
      albaIds.has(id),
    ).length;
    const heltesPol = new Set<string>();
    for (const org of policyOrgs(map)) {
      if (org.type === "heltes" && org.id === h.id) heltesPol.add(org.pid);
      if (org.type === "alba" && albaIds.has(org.id)) heltesPol.add(org.pid);
    }

    rows.push({
      id: h.id,
      kind: "heltes",
      name: h.name,
      code: h.code,
      heltesId: null,
      heltesName: null,
      albaCount: h.albas.length,
      positionCount: heltesPos,
      policyCount: heltesPol.size,
    });

    for (const a of h.albas) {
      if (isSoleHeltesLikeAlba(h.albas.length, h.name, a.name)) continue;
      const pos = Object.entries(map.position_to_alba).filter(
        ([, id]) => id === a.id,
      ).length;
      const pol = new Set<string>();
      for (const org of policyOrgs(map)) {
        if (org.type === "alba" && org.id === a.id) pol.add(org.pid);
      }
      rows.push({
        id: a.id,
        kind: "alba",
        name: a.name,
        code: a.code,
        heltesId: h.id,
        heltesName: h.name,
        albaCount: 0,
        positionCount: pos,
        policyCount: pol.size,
      });
    }
  }

  rows.push({
    id: OTHER_HELTES_ID,
    kind: "heltes",
    name: catalog.other.name,
    code: "Бусад",
    heltesId: null,
    heltesName: null,
    albaCount: 1,
    positionCount: map.unmatched_positions.length,
    policyCount: map.unmatched_policies.length,
  });

  return rows;
}

/** Sync renamed хэлтэс/алба into job_positions + org_units labels */
async function syncUnitNamesToDb(input: {
  oldName: string;
  newName: string;
  kind: "heltes" | "alba";
  siblingHeltesName?: string | null;
}) {
  await updateDb((db) => {
    for (const p of db.job_positions) {
      if (input.kind === "heltes") {
        if (p.heltes_name === input.oldName) p.heltes_name = input.newName;
        // Sole хэлтэс-like alba often mirrors heltes name
        if (p.alba_name === input.oldName) p.alba_name = input.newName;
      } else if (p.alba_name === input.oldName) {
        p.alba_name = input.newName;
      }
      p.updated_at = new Date().toISOString();
    }
    for (const u of db.org_units) {
      if (u.name === input.oldName) u.name = input.newName;
    }
  });
}

/** Apply known naming corrections into positions/db once */
export async function applyOrgNamingCorrections() {
  const fixes: Array<{ from: string; to: string }> = [
    { from: "Дотоод хяналтын хэлтэс", to: "Дотоод хяналт шалгалтын хэлтэс" },
  ];
  await updateDb((db) => {
    let changed = false;
    for (const fix of fixes) {
      for (const p of db.job_positions) {
        if (p.heltes_name === fix.from) {
          p.heltes_name = fix.to;
          changed = true;
        }
        if (p.alba_name === fix.from) {
          p.alba_name = fix.to;
          changed = true;
        }
      }
      for (const u of db.org_units) {
        if (u.name === fix.from) {
          u.name = fix.to;
          changed = true;
        }
      }
    }
    if (changed) {
      for (const p of db.job_positions) {
        p.updated_at = new Date().toISOString();
      }
    }
  });

  // Persist catalog rename if still old
  const catalog = await loadCatalog();
  let catalogDirty = false;
  for (const h of catalog.heltes) {
    if (h.name === "Дотоод хяналтын хэлтэс") {
      h.name = "Дотоод хяналт шалгалтын хэлтэс";
      h.code = "Дотоод_хяналт_шалгалтын_хэлтэс";
      catalogDirty = true;
    }
    for (const a of h.albas) {
      if (a.name === "Дотоод хяналтын хэлтэс") {
        a.name = "Дотоод хяналт шалгалтын хэлтэс";
        catalogDirty = true;
      }
    }
  }
  if (catalogDirty) await saveCatalog(catalog);
}

export async function updateOrgUnitRegistry(input: {
  id: string;
  name: string;
  kind: "heltes" | "alba";
}) {
  const name = input.name.trim();
  if (!name) throw new Error("Нэр хоосон байна");
  if (input.id === OTHER_HELTES_ID || input.id === COMPANY_HELTES_ID) {
    throw new Error("Энэ нэгжийн нэрийг засах боломжгүй");
  }

  const catalog = await loadCatalog();
  let oldName = "";
  let found = false;

  if (input.kind === "heltes") {
    const h = catalog.heltes.find((x) => x.id === input.id);
    if (!h) throw new Error("Хэлтэс олдсонгүй");
    oldName = h.name;
    h.name = name;
    h.code = name.replace(/\s+/g, "_");
    // Sync sole хэлтэс-like alba name
    if (
      h.albas.length === 1 &&
      isSoleHeltesLikeAlba(1, oldName, h.albas[0].name)
    ) {
      h.albas[0].name = name;
    }
    found = true;
  } else {
    for (const h of catalog.heltes) {
      const a = h.albas.find((x) => x.id === input.id);
      if (!a) continue;
      oldName = a.name;
      a.name = name;
      a.code = name.replace(/\s+/g, "_");
      found = true;
      break;
    }
  }

  if (!found) throw new Error("Нэгж олдсонгүй");
  await saveCatalog(catalog);
  if (oldName !== name) {
    await syncUnitNamesToDb({
      oldName,
      newName: name,
      kind: input.kind,
    });
  }
  return { id: input.id, name, kind: input.kind };
}

function slugifyUnitId(name: string, prefix: string) {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9а-яөүё\-]+/gi, "")
    .slice(0, 48);
  return `${prefix}-${base || "unit"}-${Date.now().toString(36)}`;
}

/** Create a new хэлтэс (and optional first алба). */
export async function createHeltesUnit(input: {
  name: string;
  alba_name?: string | null;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("Хэлтэсийн нэр хоосон");
  const catalog = await loadCatalog();
  if (catalog.heltes.some((h) => h.name.toLocaleLowerCase("mn") === name.toLocaleLowerCase("mn"))) {
    throw new Error("Ижил нэртэй хэлтэс байна");
  }
  const heltesId = slugifyUnitId(name, "heltes");
  const albaName = (input.alba_name ?? name).trim() || name;
  const albaId = slugifyUnitId(albaName, "alba");
  catalog.heltes.push({
    id: heltesId,
    name,
    code: name.replace(/\s+/g, "_"),
    albas: [
      {
        id: albaId,
        name: albaName,
        code: albaName.replace(/\s+/g, "_"),
        heltes_id: heltesId,
        position_codes: [],
        policy_titles: [],
      },
    ],
    policy_titles: [],
  });
  await saveCatalog(catalog);
  return { heltesId, albaId, heltesName: name, albaName };
}

/** Create a new алба under an existing хэлтэс. */
export async function createAlbaUnit(input: {
  heltes_id: string;
  name: string;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("Албаны нэр хоосон");
  const catalog = await loadCatalog();
  const heltes = catalog.heltes.find((h) => h.id === input.heltes_id);
  if (!heltes) throw new Error("Хэлтэс олдсонгүй");
  if (heltes.albas.some((a) => a.name.toLocaleLowerCase("mn") === name.toLocaleLowerCase("mn"))) {
    throw new Error("Ижил нэртэй алба байна");
  }
  const albaId = slugifyUnitId(name, "alba");
  heltes.albas.push({
    id: albaId,
    name,
    code: name.replace(/\s+/g, "_"),
    heltes_id: heltes.id,
    position_codes: [],
    policy_titles: [],
  });
  await saveCatalog(catalog);
  return { heltesId: heltes.id, albaId, heltesName: heltes.name, albaName: name };
}

export async function getHeltes(heltesIdOrKey: string) {
  const list = await listHeltes();
  return list.find((h) => h.bteg_id === heltesIdOrKey) ?? null;
}

/** Full heltes → alba tree for /org Collapse·Expand UI. «Бусад» last. */
export async function listOrgExplorerTree(): Promise<OrgExplorerHeltes[]> {
  const heltesList = await listHeltes();
  const rows: OrgExplorerHeltes[] = [];
  for (const h of heltesList) {
    const albas = await listAlbasInHeltes(h.bteg_id);
    rows.push({
      heltesId: h.bteg_id,
      heltesName: h.name,
      albaCount: h.alba_count,
      positionCount: h.position_count,
      policyCount: h.policy_count,
      avgScore: h.avg_score,
      albas: albas.map((a) => ({
        albaId: a.bteg_id,
        albaName: a.name,
        positionCount: a.position_count,
        policyCount: a.policy_count,
        avgScore: a.avg_score,
        isDirect: a.is_direct,
      })),
    });
  }
  rows.sort((a, b) => {
    if (a.heltesId === OTHER_HELTES_ID) return 1;
    if (b.heltesId === OTHER_HELTES_ID) return -1;
    return a.heltesName.localeCompare(b.heltesName, "mn");
  });
  return rows;
}

export async function listAlbasInHeltes(heltesIdOrKey: string): Promise<OrgAlbaSummary[]> {
  const [catalog, map, db, heltes] = await Promise.all([
    loadCatalog(),
    loadMap(),
    getDb(),
    getHeltes(heltesIdOrKey),
  ]);
  if (!heltes) return [];
  const { byPolicy, byPosition } = scoreMaps(db);

  if (heltesIdOrKey === OTHER_HELTES_ID) {
    const posIds = map.unmatched_positions.map((p) => p.id);
    const polIds = map.unmatched_policies.map((p) => p.id);
    return [
      {
        bteg_id: OTHER_ALBA_ID,
        bteg_ids: [OTHER_ALBA_ID],
        name: "Бусад (файлд ойролцоо нэршилгүй)",
        heltes_id: OTHER_HELTES_ID,
        heltes_name: heltes.name,
        position_count: posIds.length,
        policy_count: polIds.length,
        avg_score: avg([
          avgFromIds(polIds, byPolicy),
          avgFromIds(posIds, byPosition),
        ].filter((x): x is number => x != null)),
        is_direct: false,
      },
    ];
  }

  const ref = catalog.heltes.find((h) => h.id === heltesIdOrKey);
  if (!ref) return [];

  const soleAlba = ref.albas.length === 1 ? ref.albas[0] : null;
  const heltesPolicyIds = policyOrgs(map)
    .filter((org) => org.type === "heltes" && org.id === ref.id)
    .map((org) => org.pid);

  const rows = ref.albas.map((a) => {
    const positionIds = Object.entries(map.position_to_alba)
      .filter(([, albaId]) => albaId === a.id)
      .map(([pid]) => pid);
    const policyIds = new Set<string>();
    for (const org of policyOrgs(map)) {
      // Only alba-scoped policies — do not inherit all heltes policies
      if (org.type === "alba" && org.id === a.id) policyIds.add(org.pid);
    }
    // Single-alba хэлтэс: fold heltes-level policies into that alba row
    if (soleAlba && a.id === soleAlba.id) {
      for (const pid of heltesPolicyIds) policyIds.add(pid);
    }
    return {
      bteg_id: a.id,
      bteg_ids: [a.id],
      name: a.name,
      heltes_id: ref.id,
      heltes_name: ref.name,
      position_count: positionIds.length,
      policy_count: policyIds.size,
      avg_score: avg([
        avgFromIds(policyIds, byPolicy),
        avgFromIds(positionIds, byPosition),
      ].filter((x): x is number => x != null)),
      is_direct: false,
    };
  });

  // Multi-alba leftover: synthetic row for department-wide policies
  if (!soleAlba && heltesPolicyIds.length) {
    rows.push({
      bteg_id: `${ref.id}::heltes-common`,
      bteg_ids: [`${ref.id}::heltes-common`],
      name: "Хэлтэсийн нийтлэг журам",
      heltes_id: ref.id,
      heltes_name: ref.name,
      position_count: 0,
      policy_count: heltesPolicyIds.length,
      avg_score: avgFromIds(heltesPolicyIds, byPolicy),
      is_direct: true,
    } satisfies OrgAlbaSummary);
  }

  return rows.sort((a, b) => {
    if (a.is_direct !== b.is_direct) return a.is_direct ? 1 : -1;
    return a.name.localeCompare(b.name, "mn");
  });
}

export async function getAlbaContext(heltesIdOrKey: string, albaIdOrKey: string) {
  const heltes = await getHeltes(heltesIdOrKey);
  const albas = await listAlbasInHeltes(heltesIdOrKey);
  const alba = albas.find((a) => a.bteg_id === albaIdOrKey) ?? null;
  return { heltes, alba };
}

export async function listAlbaPositions(heltesIdOrKey: string, albaIdOrKey: string) {
  const [map, db, ctx] = await Promise.all([
    loadMap(),
    getDb(),
    getAlbaContext(heltesIdOrKey, albaIdOrKey),
  ]);
  if (!ctx.heltes || !ctx.alba) return [];
  const { byPosition } = scoreMaps(db);
  const jd = new Set(db.job_descriptions.map((d) => d.job_position_id));

  let positionIds: string[];
  if (albaIdOrKey === OTHER_ALBA_ID) {
    positionIds = map.unmatched_positions.map((p) => p.id);
  } else {
    positionIds = Object.entries(map.position_to_alba)
      .filter(([, albaId]) => albaId === albaIdOrKey)
      .map(([pid]) => pid);
  }

  const byId = new Map(db.job_positions.map((p) => [p.id, p]));
  return positionIds
    .map((id) => byId.get(id))
    .filter((p): p is JobPosition => Boolean(p?.is_active))
    .map((p) => ({
      position: p,
      has_job_description: jd.has(p.id),
      avg_score: avg(byPosition.get(p.id) ?? []),
      obligation_count: db.clause_position_responsibilities.filter(
        (l) => l.is_active && l.job_position_id === p.id,
      ).length,
    }))
    .sort((a, b) => a.position.name.localeCompare(b.position.name, "mn"));
}

export type AlbaPolicyRow = {
  policy: Policy;
  avg_score: number | null;
  evaluation_count: number;
  linked_position_count: number;
  clause_count: number;
  scope_label: string;
};

export async function listAlbaPolicies(
  heltesIdOrKey: string,
  albaIdOrKey: string,
): Promise<AlbaPolicyRow[]> {
  const [map, db, ctx, catalog] = await Promise.all([
    loadMap(),
    getDb(),
    getAlbaContext(heltesIdOrKey, albaIdOrKey),
    loadCatalog(),
  ]);
  if (!ctx.heltes || !ctx.alba) return [];
  const { byPolicy, latest } = scoreMaps(db);
  const positions = await listAlbaPositions(heltesIdOrKey, albaIdOrKey);
  const positionIds = new Set(positions.map((p) => p.position.id));

  const policyEntries: Array<{ id: string; scope_label: string }> = [];
  if (albaIdOrKey === OTHER_ALBA_ID) {
    for (const p of map.unmatched_policies) {
      policyEntries.push({ id: p.id, scope_label: "Бусад" });
    }
  } else if (albaIdOrKey.endsWith("::heltes-common")) {
    const heltesId = albaIdOrKey.replace(/::heltes-common$/, "");
    for (const org of policyOrgs(map)) {
      if (org.type === "heltes" && org.id === heltesId) {
        policyEntries.push({
          id: org.pid,
          scope_label: ctx.heltes.name,
        });
      }
    }
  } else {
    for (const org of policyOrgs(map)) {
      if (org.type === "alba" && org.id === albaIdOrKey) {
        policyEntries.push({ id: org.pid, scope_label: ctx.alba.name });
      }
    }
    // Sole alba: also show heltes-level policies folded into this unit
    const heltesRef = catalog.heltes.find((h) => h.id === heltesIdOrKey);
    if (heltesRef?.albas.length === 1 && heltesRef.albas[0].id === albaIdOrKey) {
      for (const org of policyOrgs(map)) {
        if (org.type === "heltes" && org.id === heltesRef.id) {
          policyEntries.push({ id: org.pid, scope_label: ctx.heltes.name });
        }
      }
    }
  }

  const rows: AlbaPolicyRow[] = [];
  const seen = new Set<string>();
  for (const entry of policyEntries) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    const policy = db.policies.find((p) => p.id === entry.id && !p.is_deleted);
    if (!policy) continue;
    const clauseIds = new Set(
      db.policy_clauses
        .filter((c) => c.policy_id === policy.id && !c.is_deleted)
        .map((c) => c.id),
    );
    const linkedPositions = new Set(
      db.clause_position_responsibilities
        .filter(
          (l) =>
            l.is_active &&
            clauseIds.has(l.policy_clause_id) &&
            positionIds.has(l.job_position_id),
        )
        .map((l) => l.job_position_id),
    );
    rows.push({
      policy,
      avg_score: avg(byPolicy.get(policy.id) ?? []),
      evaluation_count: latest.filter((e) => clauseIds.has(e.policy_clause_id)).length,
      linked_position_count: linkedPositions.size,
      clause_count: clauseIds.size,
      scope_label: entry.scope_label,
    });
  }

  return rows.sort((a, b) => a.policy.name.localeCompare(b.policy.name, "mn"));
}

export async function listAlbaPolicyPositions(
  heltesIdOrKey: string,
  albaIdOrKey: string,
) {
  const policies = await listAlbaPolicies(heltesIdOrKey, albaIdOrKey);
  const positions = await listAlbaPositions(heltesIdOrKey, albaIdOrKey);
  const db = await getDb();
  const policyIds = new Set(policies.map((p) => p.policy.id));
  const clauseToPolicy = new Map(
    db.policy_clauses.map((c) => [c.id, c.policy_id] as const),
  );

  return positions
    .map((row) => {
      const relatedPolicyIds = new Set<string>();
      for (const l of db.clause_position_responsibilities) {
        if (!l.is_active || l.job_position_id !== row.position.id) continue;
        const pid = clauseToPolicy.get(l.policy_clause_id);
        if (pid && policyIds.has(pid)) relatedPolicyIds.add(pid);
      }
      return { ...row, related_policy_count: relatedPolicyIds.size };
    })
    .filter((r) => r.related_policy_count > 0 || r.obligation_count > 0);
}

export async function getOrgPositionDetail(positionId: string) {
  const db = await getDb();
  const position = db.job_positions.find((p) => p.id === positionId);
  if (!position) return null;
  const description: JobDescription | null =
    db.job_descriptions.find((d) => d.job_position_id === positionId) ?? null;
  const { latest, clauseToPolicy } = (() => {
    const s = scoreMaps(db);
    return s;
  })();

  const links = db.clause_position_responsibilities.filter(
    (l) => l.is_active && l.job_position_id === positionId,
  );
  const policyIds = new Set<string>();
  const clauseMap = new Map(db.policy_clauses.map((c) => [c.id, c]));
  const policyMap = new Map(db.policies.map((p) => [p.id, p]));

  for (const l of links) {
    const pid = clauseToPolicy.get(l.policy_clause_id);
    if (pid) policyIds.add(pid);
  }

  const latestByKey = new Map(
    latest
      .filter((e) => e.job_position_id === positionId)
      .map((e) => [
        `${e.policy_clause_id}:${e.responsibility_type}`,
        e,
      ] as const),
  );

  const posScores = new Map<string, number[]>();
  for (const e of latest) {
    if (e.job_position_id !== positionId) continue;
    const pid = clauseToPolicy.get(e.policy_clause_id);
    if (!pid) continue;
    const list = posScores.get(pid) ?? [];
    list.push(e.score);
    posScores.set(pid, list);
  }

  const policies = [...policyIds]
    .map((id) => {
      const policy = policyMap.get(id);
      if (!policy) return null;
      return {
        policy,
        avg_score: avg(posScores.get(id) ?? []),
        obligation_count: links.filter(
          (l) => clauseToPolicy.get(l.policy_clause_id) === id,
        ).length,
      };
    })
    .filter(Boolean) as Array<{
    policy: Policy;
    avg_score: number | null;
    obligation_count: number;
  }>;

  const obligations = links
    .map((link) => {
      const clause = clauseMap.get(link.policy_clause_id);
      const policy = clause ? policyMap.get(clause.policy_id) : undefined;
      const evaluation =
        latestByKey.get(`${link.policy_clause_id}:${link.responsibility_type}`) ??
        null;
      return { link, clause, policy, evaluation };
    })
    .sort((a, b) =>
      (a.policy?.name ?? "").localeCompare(b.policy?.name ?? "", "mn"),
    );

  return {
    position,
    description,
    policies: policies.sort((a, b) => a.policy.name.localeCompare(b.policy.name, "mn")),
    obligations,
    avg_score: avg(
      latest.filter((e) => e.job_position_id === positionId).map((e) => e.score),
    ),
  };
}

/** Same heltes → alba tree as the Хэлтэс sidebar navigation. */
export async function listOrgAssignTree(): Promise<OrgAssignTree> {
  const catalog = await loadCatalog();
  return {
    heltes: [
      {
        id: COMPANY_HELTES_ID,
        name: COMPANY_SCOPE_LABEL,
        albas: [{ id: COMPANY_ALBA_ID, name: COMPANY_SCOPE_LABEL }],
      },
      ...catalog.heltes.map((h) => {
        const albas = h.albas.map((a) => ({ id: a.id, name: a.name }));
        albas.push({
          id: `${h.id}::heltes-common`,
          name: HELTES_COMMON_LABEL,
        });
        return { id: h.id, name: h.name, albas };
      }),
    ],
    other: { id: OTHER_HELTES_ID, name: catalog.other.name },
  };
}

export type PolicyOrgAssignment = {
  heltesId: string;
  albaId: string;
  heltes: string;
  alba: string;
};

/** Resolve current хэлтэс/алба assignment (with ids for dropdowns). */
export async function getPolicyOrgAssignments(): Promise<
  Map<string, PolicyOrgAssignment>
> {
  const [catalog, map] = await Promise.all([loadCatalog(), loadMap()]);
  const heltesName = new Map(catalog.heltes.map((h) => [h.id, h.name]));
  const albaMeta = new Map<string, { name: string; heltesId: string; heltes: string }>();
  for (const h of catalog.heltes) {
    for (const a of h.albas) {
      albaMeta.set(a.id, { name: a.name, heltesId: h.id, heltes: h.name });
    }
  }

  const out = new Map<string, PolicyOrgAssignment>();

  for (const [policyId, orgs] of Object.entries(map.policy_to_org)) {
    const primary = (orgs ?? [])[0];
    if (!primary) continue;
    if (primary.type === "company") {
      out.set(policyId, {
        heltesId: COMPANY_HELTES_ID,
        albaId: COMPANY_ALBA_ID,
        heltes: COMPANY_SCOPE_LABEL,
        alba: COMPANY_SCOPE_LABEL,
      });
      continue;
    }
    if (primary.type === "alba") {
      const meta = albaMeta.get(primary.id);
      if (!meta) continue;
      out.set(policyId, {
        heltesId: meta.heltesId,
        albaId: primary.id,
        heltes: meta.heltes,
        alba: meta.name,
      });
    } else {
      const hName = heltesName.get(primary.id) ?? primary.id;
      const heltesRef = catalog.heltes.find((h) => h.id === primary.id);
      if (heltesRef?.albas.length === 1) {
        const only = heltesRef.albas[0];
        out.set(policyId, {
          heltesId: primary.id,
          albaId: only.id,
          heltes: hName,
          alba: only.name,
        });
      } else {
        out.set(policyId, {
          heltesId: primary.id,
          albaId: `${primary.id}::heltes-common`,
          heltes: hName,
          alba: HELTES_COMMON_LABEL,
        });
      }
    }
  }

  for (const p of map.unmatched_policies ?? []) {
    if (!out.has(p.id)) {
      out.set(p.id, {
        heltesId: OTHER_HELTES_ID,
        albaId: OTHER_ALBA_ID,
        heltes: catalog.other.name,
        alba: "—",
      });
    }
  }

  return out;
}

/** @deprecated use getPolicyOrgAssignments */
export async function getPolicyOrgLabels(): Promise<
  Map<string, { heltes: string; alba: string }>
> {
  const map = await getPolicyOrgAssignments();
  return new Map(
    [...map.entries()].map(([id, a]) => [id, { heltes: a.heltes, alba: a.alba }]),
  );
}

/**
 * Persist policy ↔ хэлтэс/алба assignment used by Org, dashboard, and policy list.
 * Survives reference rebuild via policy-org-overrides.json.
 */
export async function setPolicyOrgAssignment(input: {
  policy_id: string;
  policy_name?: string;
  heltes_id: string;
  alba_id: string;
}) {
  const catalog = await loadCatalog();
  const overrides = await loadOverrides();

  let orgs: Array<OrgRef> | null;

  if (input.heltes_id === OTHER_HELTES_ID || input.alba_id === OTHER_ALBA_ID) {
    orgs = null;
  } else if (
    input.heltes_id === COMPANY_HELTES_ID ||
    input.alba_id === COMPANY_ALBA_ID
  ) {
    orgs = [{ type: "company", id: "all" }];
  } else if (input.alba_id.endsWith("::heltes-common")) {
    const heltesId = input.alba_id.replace(/::heltes-common$/, "");
    if (!catalog.heltes.some((h) => h.id === heltesId)) {
      throw new Error("Хэлтэс олдсонгүй");
    }
    orgs = [{ type: "heltes", id: heltesId }];
  } else {
    const heltesRef = catalog.heltes.find((h) => h.id === input.heltes_id);
    if (!heltesRef) throw new Error("Хэлтэс олдсонгүй");
    const alba = heltesRef.albas.find((a) => a.id === input.alba_id);
    if (!alba) throw new Error("Алба олдсонгүй");
    orgs = [{ type: "alba", id: alba.id }];
  }

  overrides[input.policy_id] = {
    orgs,
    policy_name: input.policy_name,
  };
  await saveOverrides(overrides);

  // Also write into reference-map so raw file matches UI without relying only on merge.
  try {
    const raw = JSON.parse(
      await fs.readFile(mapPath(), "utf8"),
    ) as ReferenceMap;
    const next = applyPolicyOrgOverrides(raw, overrides);
    // Keep stats roughly consistent
    if (next.stats) {
      next.stats.matched_policies = Object.keys(next.policy_to_org).length;
      next.stats.unmatched_policies = next.unmatched_policies.length;
    }
    await saveMap(next);
  } catch {
    // If map missing, overrides alone still apply on next loadMap()
  }
}

export type UnitPolicyAllocationRow = {
  heltesId: string;
  heltesName: string;
  albaId: string;
  albaName: string;
  policies: Array<{ id: string; name: string; reference_code?: string | null }>;
};

/** Group current policy↔org assignments by heltes+alba for settings UI. */
export async function listUnitPolicyAllocations(): Promise<
  UnitPolicyAllocationRow[]
> {
  const [assignments, policies] = await Promise.all([
    getPolicyOrgAssignments(),
    getDb().then((db) => db.policies.filter((p) => !p.is_deleted)),
  ]);
  const byName = new Map(policies.map((p) => [p.id, p]));
  const grouped = new Map<string, UnitPolicyAllocationRow>();

  for (const [policyId, org] of assignments.entries()) {
    if (org.heltesId === OTHER_HELTES_ID || org.albaId === OTHER_ALBA_ID) {
      continue;
    }
    const key = `${org.heltesId}::${org.albaId}`;
    let row = grouped.get(key);
    if (!row) {
      row = {
        heltesId: org.heltesId,
        heltesName: org.heltes,
        albaId: org.albaId,
        albaName: org.alba,
        policies: [],
      };
      grouped.set(key, row);
    }
    const p = byName.get(policyId);
    row.policies.push({
      id: policyId,
      name: p?.name ?? policyId,
      reference_code: p?.reference_code ?? null,
    });
  }

  return [...grouped.values()]
    .map((r) => ({
      ...r,
      policies: r.policies.sort((a, b) => a.name.localeCompare(b.name, "mn")),
    }))
    .sort(
      (a, b) =>
        a.heltesName.localeCompare(b.heltesName, "mn") ||
        a.albaName.localeCompare(b.albaName, "mn"),
    );
}

/**
 * Set which policies belong to a heltes+alba unit.
 * Selected policies move to this unit; previously assigned but unchecked go to «бусад».
 */
export async function setUnitPolicyAllocations(input: {
  heltes_id: string;
  alba_id: string;
  policy_ids: string[];
  policy_names?: Record<string, string>;
}) {
  const selected = new Set(input.policy_ids.filter(Boolean));
  const assignments = await getPolicyOrgAssignments();
  const previouslyOnUnit = [...assignments.entries()]
    .filter(
      ([, org]) =>
        org.heltesId === input.heltes_id && org.albaId === input.alba_id,
    )
    .map(([id]) => id);

  for (const policyId of selected) {
    await setPolicyOrgAssignment({
      policy_id: policyId,
      policy_name: input.policy_names?.[policyId],
      heltes_id: input.heltes_id,
      alba_id: input.alba_id,
    });
  }

  for (const policyId of previouslyOnUnit) {
    if (selected.has(policyId)) continue;
    await setPolicyOrgAssignment({
      policy_id: policyId,
      heltes_id: OTHER_HELTES_ID,
      alba_id: OTHER_ALBA_ID,
    });
  }
}

/** Heltes → alba tree for positions (no «нийтлэг журам» synthetic row). */
export async function listOrgPositionAssignTree(): Promise<OrgAssignTree> {
  const catalog = await loadCatalog();
  return {
    heltes: catalog.heltes.map((h) => ({
      id: h.id,
      name: h.name,
      albas: h.albas.map((a) => ({ id: a.id, name: a.name })),
    })),
    other: { id: OTHER_HELTES_ID, name: catalog.other.name },
  };
}

export async function listPositionsForOrgTree(q?: string): Promise<PositionListRow[]> {
  const [db, map, catalog, tree, positionOverrides] = await Promise.all([
    getDb(),
    loadMap(),
    loadCatalog(),
    listOrgPositionAssignTree(),
    loadPositionOverrides(),
  ]);
  const albaMeta = new Map<string, { heltesId: string; heltes: string; alba: string }>();
  for (const h of catalog.heltes) {
    for (const a of h.albas) {
      albaMeta.set(a.id, { heltesId: h.id, heltes: h.name, alba: a.name });
    }
  }

  const jd = new Set(db.job_descriptions.map((d) => d.job_position_id));
  const aCodeByPosition = new Map(
    db.job_descriptions.map((d) => [d.job_position_id, d.a_code]),
  );
  const linkCount = new Map<string, number>();
  for (const l of db.clause_position_responsibilities) {
    if (!l.is_active) continue;
    linkCount.set(l.job_position_id, (linkCount.get(l.job_position_id) ?? 0) + 1);
  }

  let items = db.job_positions.filter((p) => p.is_active);
  if (q) {
    const s = q.toLowerCase();
    items = items.filter((p) => {
      const ovOrg = positionOverrides[p.id]?.organization_name;
      const orgName = (ovOrg !== undefined ? ovOrg : p.organization_name) ?? "";
      return (
        p.name.toLowerCase().includes(s) ||
        (p.bteg_id ?? "").includes(s) ||
        (p.official_code ?? "").toLowerCase().includes(s) ||
        (aCodeByPosition.get(p.id) ?? "").toLowerCase().includes(s) ||
        orgName.toLowerCase().includes(s) ||
        (p.heltes_name ?? "").toLowerCase().includes(s) ||
        (p.alba_name ?? "").toLowerCase().includes(s)
      );
    });
  }

  const rows: PositionListRow[] = items.map((p) => {
    const mappedAlba = map.position_to_alba[p.id];
    const meta = mappedAlba ? albaMeta.get(mappedAlba) : undefined;
    const ov = positionOverrides[p.id];
    const organization_name = (
      ov?.organization_name !== undefined
        ? (ov.organization_name ?? "")
        : (p.organization_name ?? "")
    ).trim();
    const isOther =
      !meta ||
      map.unmatched_positions.some((u) => u.id === p.id) ||
      (p.heltes_name === "Бусад" && !mappedAlba);

    if (isOther && !meta) {
      return {
        id: p.id,
        name: p.name,
        bteg_id: p.bteg_id,
        official_code:
          (p.official_code ?? "").trim() ||
          (aCodeByPosition.get(p.id) ?? "").trim() ||
          null,
        organization_name,
        heltesId: OTHER_HELTES_ID,
        albaId: OTHER_ALBA_ID,
        heltes: tree.other.name,
        alba: "—",
        has_job_description: jd.has(p.id),
        link_count: linkCount.get(p.id) ?? 0,
      };
    }

    return {
      id: p.id,
      name: p.name,
      bteg_id: p.bteg_id,
      official_code:
        (p.official_code ?? "").trim() ||
        (aCodeByPosition.get(p.id) ?? "").trim() ||
        null,
      organization_name,
      heltesId: meta!.heltesId,
      albaId: mappedAlba!,
      heltes: meta!.heltes,
      alba: meta!.alba,
      has_job_description: jd.has(p.id),
      link_count: linkCount.get(p.id) ?? 0,
    };
  });

  return rows.sort((a, b) => {
    const orgCmp = (a.organization_name || "\uffff").localeCompare(
      b.organization_name || "\uffff",
      "mn",
    );
    if (orgCmp) return orgCmp;
    const hCmp = a.heltes.localeCompare(b.heltes, "mn");
    if (hCmp) return hCmp;
    const aCmp = a.alba.localeCompare(b.alba, "mn");
    if (aCmp) return aCmp;
    return a.name.localeCompare(b.name, "mn");
  });
}

export async function setPositionOrgAssignment(input: {
  position_id: string;
  organization_name?: string | null;
  heltes_id: string;
  alba_id: string;
}) {
  const catalog = await loadCatalog();
  let heltesName = "Бусад";
  let albaName = "Бусад";

  if (input.heltes_id !== OTHER_HELTES_ID && input.alba_id !== OTHER_ALBA_ID) {
    const heltesRef = catalog.heltes.find((h) => h.id === input.heltes_id);
    if (!heltesRef) throw new Error("Хэлтэс олдсонгүй");
    const alba = heltesRef.albas.find((a) => a.id === input.alba_id);
    if (!alba) throw new Error("Алба олдсонгүй");
    heltesName = heltesRef.name;
    albaName = alba.name;
  }

  let positionName = input.position_id;
  let orgName: string | null = null;
  await updateDb((db) => {
    const p = db.job_positions.find((x) => x.id === input.position_id);
    if (!p) throw new Error("Ажлын байр олдсонгүй");
    positionName = p.name;
    if (input.organization_name !== undefined) {
      p.organization_name = input.organization_name?.trim() || null;
    } else if (p.organization_name === undefined) {
      p.organization_name = null;
    }
    orgName = p.organization_name ?? null;
    p.heltes_name = heltesName;
    p.alba_name = albaName;
    p.updated_at = new Date().toISOString();
  });

  const overrides = await loadPositionOverrides();
  overrides[input.position_id] = {
    organization_name: orgName,
    heltes_id: input.heltes_id,
    alba_id: input.alba_id,
    position_name: positionName,
  };
  await savePositionOverrides(overrides);

  try {
    const raw = JSON.parse(
      await fs.readFile(mapPath(), "utf8"),
    ) as ReferenceMap;
    const next = applyPositionOrgOverrides(
      applyPolicyOrgOverrides(raw, await loadOverrides()),
      overrides,
    );
    if (next.stats) {
      next.stats.matched_positions = Object.keys(next.position_to_alba).length;
      next.stats.unmatched_positions = next.unmatched_positions.length;
    }
    await saveMap(next);
  } catch {
    // overrides alone still apply
  }
}

/** Resolve which org unit a job position belongs to (map + catalog). */
export async function resolvePositionOrg(positionId: string): Promise<{
  heltesId: string | null;
  albaId: string | null;
} | null> {
  const [map, catalog] = await Promise.all([loadMap(), loadCatalog()]);
  const albaId = map.position_to_alba[positionId] ?? null;
  if (!albaId) return { heltesId: null, albaId: null };
  for (const h of catalog.heltes) {
    if (h.albas.some((a) => a.id === albaId)) {
      return { heltesId: h.id, albaId };
    }
  }
  return { heltesId: null, albaId };
}

/**
 * Org-scoped policies (company / heltes-common / alba) are visible to matching
 * positions without per-clause responsibility links.
 */
export async function listOrgVisiblePolicyIdsForPosition(
  positionId: string,
): Promise<Set<string>> {
  const [map, posOrg] = await Promise.all([
    loadMap(),
    resolvePositionOrg(positionId),
  ]);
  const visible = new Set<string>();
  for (const [pid, orgs] of Object.entries(map.policy_to_org)) {
    const primary = (orgs ?? [])[0];
    if (!primary) continue;
    if (primary.type === "company") {
      visible.add(pid);
      continue;
    }
    if (!posOrg?.heltesId) continue;
    if (primary.type === "heltes" && primary.id === posOrg.heltesId) {
      visible.add(pid);
      continue;
    }
    if (
      primary.type === "alba" &&
      posOrg.albaId &&
      primary.id === posOrg.albaId
    ) {
      visible.add(pid);
    }
  }
  return visible;
}

export async function isPolicyOrgVisibleToPosition(
  policyId: string,
  positionId: string,
): Promise<boolean> {
  const set = await listOrgVisiblePolicyIdsForPosition(positionId);
  return set.has(policyId);
}

function positionCodeLabel(code: string) {
  return code.replace(/_/g, " ").replace(/-/g, " · ").trim();
}

/** Public dropdown payload for portal access-request forms. */
export async function getAccessOptions() {
  const { resolveJobPositionRef } = await import(
    "@/lib/access/resolve-position"
  );
  const catalog = await loadCatalog();
  const heltes = await Promise.all(
    catalog.heltes.map(async (h) => {
      const albas = await Promise.all(
        h.albas.map(async (a) => {
          let positions: Array<{ id: string; name: string }> = [];
          try {
            const rows = await listAlbaPositions(h.id, a.id);
            positions = rows.map((r) => ({
              id: r.position.id,
              name: r.position.name,
            }));
          } catch {
            positions = [];
          }
          if (positions.length === 0) {
            const mapped = await Promise.all(
              (a.position_codes ?? []).map(async (code) => {
                const label = positionCodeLabel(code);
                const resolved = await resolveJobPositionRef(
                  `code:${code}`,
                  label,
                );
                return {
                  id: resolved?.id ?? `code:${code}`,
                  name: resolved?.name ?? label,
                };
              }),
            );
            positions = mapped;
          }
          return {
            id: a.id,
            name: a.name,
            positions,
          };
        }),
      );
      return { id: h.id, name: h.name, albas };
    }),
  );
  return { heltes };
}
