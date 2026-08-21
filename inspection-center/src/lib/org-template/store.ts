import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import {
  loadRemotePayload,
  saveRemotePayload,
  REMOTE_KEYS,
} from "@/lib/store/remote";
import {
  allocationKey,
  emptyAllocationStore,
  type OrgTemplateAllocation,
  type OrgTemplateAllocationStore,
  type AllocatedTemplateRef,
} from "@/lib/org-template/types";

function dataDir() {
  if (process.env.DATA_DIR?.trim()) return process.env.DATA_DIR.trim();
  if (process.env.VERCEL || process.env.USE_TMP_DATA === "1") {
    return path.join("/tmp", "inspection-center-data");
  }
  return path.join(process.cwd(), "data");
}

function localPath() {
  return path.join(dataDir(), "org-template-allocations.json");
}

function preferRemote() {
  return Boolean(process.env.VERCEL) || process.env.USE_REMOTE_STORE === "1";
}

function normalizeStore(raw: unknown): OrgTemplateAllocationStore {
  if (!raw || typeof raw !== "object") return emptyAllocationStore();
  const obj = raw as OrgTemplateAllocationStore;
  if (!Array.isArray(obj.allocations)) return emptyAllocationStore();
  return {
    version: 1,
    allocations: obj.allocations.filter(
      (a) => a && typeof a.heltesId === "string" && typeof a.albaId === "string",
    ),
  };
}

export async function readOrgTemplateAllocations(): Promise<OrgTemplateAllocationStore> {
  if (preferRemote()) {
    const remote = await loadRemotePayload<OrgTemplateAllocationStore>(
      REMOTE_KEYS.orgTemplateAllocations,
    );
    if (remote) return normalizeStore(remote);
  }
  try {
    const raw = await fs.readFile(localPath(), "utf8");
    return normalizeStore(JSON.parse(raw));
  } catch {
    return emptyAllocationStore();
  }
}

export async function writeOrgTemplateAllocations(
  store: OrgTemplateAllocationStore,
): Promise<void> {
  const normalized = normalizeStore(store);
  if (preferRemote()) {
    const ok = await saveRemotePayload(
      REMOTE_KEYS.orgTemplateAllocations,
      normalized,
    );
    if (!ok) {
      throw new Error("Supabase дээр холболт хадгалж чадсангүй");
    }
  }
  try {
    await fs.mkdir(dataDir(), { recursive: true });
    await fs.writeFile(localPath(), JSON.stringify(normalized, null, 2), "utf8");
  } catch {
    // remote-only environments may be read-only locally
  }
}

export async function upsertOrgTemplateAllocation(input: {
  heltesId: string;
  heltesName: string;
  albaId: string;
  albaName: string;
  templates: AllocatedTemplateRef[];
  updatedBy?: string | null;
}): Promise<OrgTemplateAllocation> {
  const store = await readOrgTemplateAllocations();
  const key = allocationKey(input.heltesId, input.albaId);
  const now = new Date().toISOString();
  const templates = input.templates.filter((t) => t.id && t.title);
  const existing = store.allocations.find(
    (a) => allocationKey(a.heltesId, a.albaId) === key,
  );
  const row: OrgTemplateAllocation = {
    id: existing?.id ?? randomUUID(),
    heltesId: input.heltesId,
    heltesName: input.heltesName,
    albaId: input.albaId,
    albaName: input.albaName,
    templateIds: templates.map((t) => t.id),
    templates,
    updatedAt: now,
    updatedBy: input.updatedBy ?? null,
  };
  store.allocations = [
    row,
    ...store.allocations.filter(
      (a) => allocationKey(a.heltesId, a.albaId) !== key,
    ),
  ];
  await writeOrgTemplateAllocations(store);
  return row;
}

export async function deleteOrgTemplateAllocation(
  heltesId: string,
  albaId: string,
): Promise<boolean> {
  const store = await readOrgTemplateAllocations();
  const key = allocationKey(heltesId, albaId);
  const before = store.allocations.length;
  store.allocations = store.allocations.filter(
    (a) => allocationKey(a.heltesId, a.albaId) !== key,
  );
  if (store.allocations.length === before) return false;
  await writeOrgTemplateAllocations(store);
  return true;
}

/** Allocations visible to a unit-scoped user (own heltes/alba). */
export async function allocationsForUnit(params: {
  heltesId?: string | null;
  albaId?: string | null;
  heltesName?: string | null;
  albaName?: string | null;
}): Promise<OrgTemplateAllocation[]> {
  const store = await readOrgTemplateAllocations();
  const normalize = (s: string | null | undefined) =>
    (s ?? "")
      .toLowerCase()
      .replace(/[[\]]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  return store.allocations.filter((a) => {
    if (params.albaId && a.albaId === params.albaId) return true;
    if (params.heltesId && a.heltesId === params.heltesId) return true;
    const alba = normalize(params.albaName);
    const heltes = normalize(params.heltesName);
    if (alba && normalize(a.albaName).includes(alba)) return true;
    if (heltes && normalize(a.heltesName).includes(heltes)) return true;
    if (alba && normalize(a.albaName) === alba) return true;
    return false;
  });
}
