import { promises as fs } from "fs";
import path from "path";
import type {
  AuditEvent,
  CreateProcessNodeInput,
  DfdNode,
  ProcessFile,
  ProcessMatrixDocument,
  ProcessMatrixRow,
  ProcessModuleDb,
  ProcessNode,
  ProcessNodeTree,
  UpdateProcessNodeInput,
} from "@/lib/types";
import { newId, nowIso } from "@/lib/cn";
import {
  loadRemoteProcessDb,
  preferRemoteStore,
  saveRemoteProcessDb,
} from "@/lib/db/remote-store";
import { buildSeedDb, emptyDb } from "@/lib/seed";

const STORE_KEY = "process_module_db";
const DATA_FILE = path.join(process.cwd(), "data", "store.json");

function migrateToV2(raw: Record<string, unknown>): ProcessModuleDb {
  const base = emptyDb();
  return {
    ...base,
    nodes: (raw.nodes as ProcessNode[]) ?? [],
    raci_links: (raw.raci_links as ProcessModuleDb["raci_links"]) ?? [],
    inspection_links:
      (raw.inspection_links as ProcessModuleDb["inspection_links"]) ?? [],
    issue_links: (raw.issue_links as ProcessModuleDb["issue_links"]) ?? [],
    risk_links: (raw.risk_links as ProcessModuleDb["risk_links"]) ?? [],
    employee_report_links:
      (raw.employee_report_links as ProcessModuleDb["employee_report_links"]) ??
      [],
    files: (raw.files as ProcessFile[]) ?? [],
    dfd_nodes: (raw.dfd_nodes as DfdNode[]) ?? [],
    matrix_rows: (raw.matrix_rows as ProcessMatrixRow[]) ?? [],
    matrix_docs: (raw.matrix_docs as ProcessMatrixDocument[]) ?? [],
    audit: (raw.audit as AuditEvent[]) ?? [],
    updated_at: typeof raw.updated_at === "string" ? raw.updated_at : nowIso(),
  };
}

async function ensureDir() {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
}

async function readFileDb(): Promise<ProcessModuleDb | null> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || !Array.isArray(parsed.nodes)) return null;
    if (parsed.version === 2) return parsed as unknown as ProcessModuleDb;
    return migrateToV2(parsed);
  } catch {
    return null;
  }
}

async function writeFileDb(db: ProcessModuleDb) {
  db.version = 2;
  db.updated_at = nowIso();
  if (preferRemoteStore()) {
    const ok = await saveRemoteProcessDb(db);
    if (!ok) {
      throw new Error("Failed to persist process_module_db to remote store");
    }
    // Best-effort local mirror (ignored on Vercel ephemeral FS)
    try {
      await ensureDir();
      await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
    } catch {
      // ignore
    }
    return;
  }
  await ensureDir();
  await fs.writeFile(DATA_FILE, JSON.stringify(db, null, 2), "utf8");
}

export async function loadDb(): Promise<ProcessModuleDb> {
  if (preferRemoteStore()) {
    const remote = await loadRemoteProcessDb();
    if (remote && Array.isArray(remote.nodes)) {
      if (
        !remote.files ||
        !remote.dfd_nodes ||
        !remote.matrix_rows ||
        !remote.audit
      ) {
        return migrateToV2(remote as unknown as Record<string, unknown>);
      }
      return remote;
    }
    const seed = buildSeedDb();
    await writeFileDb(seed);
    return seed;
  }

  const existing = await readFileDb();
  if (existing) {
    if (
      !existing.files ||
      !existing.dfd_nodes ||
      !existing.matrix_rows ||
      !existing.audit
    ) {
      const migrated = migrateToV2(existing as unknown as Record<string, unknown>);
      await writeFileDb(migrated);
      return migrated;
    }
    return existing;
  }
  const seed = buildSeedDb();
  await writeFileDb(seed);
  return seed;
}

export async function saveDb(db: ProcessModuleDb): Promise<ProcessModuleDb> {
  await writeFileDb(db);
  return db;
}

export async function resetDbToSeed(): Promise<ProcessModuleDb> {
  const seed = buildSeedDb();
  await writeFileDb(seed);
  return seed;
}

export async function clearDb(): Promise<ProcessModuleDb> {
  const db = emptyDb();
  await writeFileDb(db);
  return db;
}

export function buildTree(nodes: ProcessNode[]): ProcessNodeTree[] {
  const byParent = new Map<string | null, ProcessNode[]>();
  for (const n of nodes) {
    const key = n.parent_id;
    const list = byParent.get(key) ?? [];
    list.push(n);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code));
  }

  function walk(parentId: string | null): ProcessNodeTree[] {
    const children = byParent.get(parentId) ?? [];
    return children.map((n) => ({
      ...n,
      children: walk(n.id),
    }));
  }

  return walk(null);
}

export function collectSubtreeIds(
  nodes: ProcessNode[],
  rootId: string,
): string[] {
  const childrenOf = new Map<string, string[]>();
  for (const n of nodes) {
    if (!n.parent_id) continue;
    const list = childrenOf.get(n.parent_id) ?? [];
    list.push(n.id);
    childrenOf.set(n.parent_id, list);
  }
  const out: string[] = [];
  const stack = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    out.push(id);
    for (const c of childrenOf.get(id) ?? []) stack.push(c);
  }
  return out;
}

export async function listNodes(): Promise<ProcessNode[]> {
  const db = await loadDb();
  return db.nodes;
}

export async function getNode(id: string): Promise<ProcessNode | null> {
  const db = await loadDb();
  return db.nodes.find((n) => n.id === id) ?? null;
}

export async function getTree(): Promise<ProcessNodeTree[]> {
  const db = await loadDb();
  return buildTree(db.nodes.filter((n) => n.status !== "ARCHIVED"));
}

export async function createNode(
  input: CreateProcessNodeInput,
): Promise<ProcessNode> {
  const db = await loadDb();
  const code = input.code.trim().toUpperCase();
  if (db.nodes.some((n) => n.code.toUpperCase() === code)) {
    throw new Error(`Process code already exists: ${code}`);
  }
  if (input.parent_id) {
    const parent = db.nodes.find((n) => n.id === input.parent_id);
    if (!parent) throw new Error("Parent process node not found");
  }
  const t = nowIso();
  const created: ProcessNode = {
    id: newId("proc"),
    code,
    title: input.title.trim(),
    description: (input.description ?? "").trim(),
    level: input.level,
    parent_id: input.parent_id ?? null,
    location_id: input.location_id?.trim() || null,
    asset_id: input.asset_id?.trim() || null,
    status: input.status ?? "DRAFT",
    sort_order: input.sort_order ?? 0,
    diagram_version: input.diagram_version ?? "1.0",
    owner: input.owner?.trim() || null,
    created_at: t,
    updated_at: t,
  };
  db.nodes.push(created);
  pushAudit(db, {
    entity_type: "process_node",
    entity_id: created.id,
    action: "create",
    detail: `Created ${created.code}`,
  });
  await saveDb(db);
  return created;
}

export async function updateNode(
  id: string,
  input: UpdateProcessNodeInput,
): Promise<ProcessNode> {
  const db = await loadDb();
  const idx = db.nodes.findIndex((n) => n.id === id);
  if (idx < 0) throw new Error("Process node not found");
  const existing = db.nodes[idx]!;

  if (input.code !== undefined) {
    const code = input.code.trim().toUpperCase();
    if (db.nodes.some((n) => n.id !== id && n.code.toUpperCase() === code)) {
      throw new Error(`Process code already exists: ${code}`);
    }
    existing.code = code;
  }
  if (input.title !== undefined) existing.title = input.title.trim();
  if (input.description !== undefined) {
    existing.description = input.description.trim();
  }
  if (input.level !== undefined) existing.level = input.level;
  if (input.parent_id !== undefined) {
    if (input.parent_id === id) throw new Error("Node cannot be its own parent");
    if (input.parent_id) {
      const parent = db.nodes.find((n) => n.id === input.parent_id);
      if (!parent) throw new Error("Parent process node not found");
      const subtree = collectSubtreeIds(db.nodes, id);
      if (subtree.includes(input.parent_id)) {
        throw new Error("Cannot move node under its own descendant");
      }
    }
    existing.parent_id = input.parent_id;
  }
  if (input.location_id !== undefined) {
    existing.location_id = input.location_id?.trim() || null;
  }
  if (input.asset_id !== undefined) {
    existing.asset_id = input.asset_id?.trim() || null;
  }
  if (input.status !== undefined) existing.status = input.status;
  if (input.sort_order !== undefined) existing.sort_order = input.sort_order;
  if (input.diagram_version !== undefined) {
    existing.diagram_version = input.diagram_version;
  }
  if (input.owner !== undefined) existing.owner = input.owner?.trim() || null;

  existing.updated_at = nowIso();
  db.nodes[idx] = existing;
  pushAudit(db, {
    entity_type: "process_node",
    entity_id: id,
    action: "update",
    detail: `Updated ${existing.code}`,
  });
  await saveDb(db);
  return existing;
}

function pushAudit(
  db: ProcessModuleDb,
  partial: Omit<AuditEvent, "id" | "created_at" | "actor"> & {
    actor?: string | null;
  },
) {
  db.audit.unshift({
    id: newId("aud"),
    actor: partial.actor ?? null,
    entity_type: partial.entity_type,
    entity_id: partial.entity_id,
    action: partial.action,
    detail: partial.detail,
    created_at: nowIso(),
  });
  if (db.audit.length > 500) db.audit.length = 500;
}

export async function getDb(): Promise<ProcessModuleDb> {
  return loadDb();
}

export async function listFiles(processId?: string): Promise<ProcessFile[]> {
  const db = await loadDb();
  const files = processId
    ? db.files.filter((f) => f.process_id === processId)
    : db.files;
  return files.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getFile(fileId: string): Promise<ProcessFile | null> {
  const db = await loadDb();
  return db.files.find((f) => f.id === fileId) ?? null;
}

export async function addProcessFile(
  file: ProcessFile,
  matrixRows?: ProcessMatrixRow[],
  matrixDoc?: ProcessMatrixDocument,
): Promise<ProcessFile> {
  const db = await loadDb();
  if (!db.nodes.some((n) => n.id === file.process_id)) {
    throw new Error("Process node not found");
  }
  // Mark previous current of same type+category as not current when versioning
  for (const f of db.files) {
    if (
      f.process_id === file.process_id &&
      f.file_type === file.file_type &&
      f.is_current &&
      f.id !== file.id
    ) {
      if (file.previous_file_id === f.id || file.is_current) {
        f.is_current = false;
      }
    }
  }
  db.files.push(file);
  if (matrixRows?.length) {
    db.matrix_rows.push(...matrixRows);
  }
  if (matrixDoc) {
    db.matrix_docs.push(matrixDoc);
  }
  pushAudit(db, {
    entity_type: "process_file",
    entity_id: file.id,
    action: file.previous_file_id ? "version" : "upload",
    detail: `${file.original_name} v${file.version}`,
  });
  await saveDb(db);
  return file;
}

export async function upsertDfdMaps(
  processId: string,
  maps: Omit<DfdNode, "id" | "created_at" | "updated_at">[],
): Promise<DfdNode[]> {
  const db = await loadDb();
  if (!db.nodes.some((n) => n.id === processId)) {
    throw new Error("Process node not found");
  }
  const saved: DfdNode[] = [];
  const t = nowIso();
  for (const m of maps) {
    const existingIdx = db.dfd_nodes.findIndex(
      (d) =>
        d.process_id === processId &&
        d.diagram_node_id === m.diagram_node_id &&
        d.element_kind === m.element_kind,
    );
    if (existingIdx >= 0) {
      const prev = db.dfd_nodes[existingIdx]!;
      const next: DfdNode = {
        ...prev,
        ...m,
        id: prev.id,
        created_at: prev.created_at,
        updated_at: t,
      };
      db.dfd_nodes[existingIdx] = next;
      saved.push(next);
    } else {
      const created: DfdNode = {
        ...m,
        id: newId("dfd"),
        created_at: t,
        updated_at: t,
      };
      db.dfd_nodes.push(created);
      saved.push(created);
    }
  }
  pushAudit(db, {
    entity_type: "dfd_node",
    entity_id: processId,
    action: "dfd_map",
    detail: `Mapped ${maps.length} DFD node(s)`,
  });
  await saveDb(db);
  return saved;
}

export async function getNodeDetails(
  processId: string,
  diagramNodeId: string,
) {
  const db = await loadDb();
  const processNode = db.nodes.find((n) => n.id === processId);
  if (!processNode) return null;
  return {
    process: processNode,
    diagram_node_id: diagramNodeId,
    dfd: db.dfd_nodes.filter(
      (d) =>
        d.process_id === processId && d.diagram_node_id === diagramNodeId,
    ),
    matrix_rows: db.matrix_rows.filter(
      (r) =>
        r.process_id === processId &&
        (r.diagram_node_id === diagramNodeId || !r.diagram_node_id),
    ),
    raci: db.raci_links.filter((r) => r.process_id === processId),
    files: db.files.filter((f) => f.process_id === processId && f.is_current),
  };
}

export async function revertFileVersion(
  fileId: string,
): Promise<ProcessFile> {
  const db = await loadDb();
  const target = db.files.find((f) => f.id === fileId);
  if (!target) throw new Error("File not found");
  for (const f of db.files) {
    if (
      f.process_id === target.process_id &&
      f.file_type === target.file_type
    ) {
      f.is_current = f.id === target.id;
    }
  }
  pushAudit(db, {
    entity_type: "process_file",
    entity_id: fileId,
    action: "revert",
    detail: `Reverted to ${target.original_name} v${target.version}`,
  });
  await saveDb(db);
  return target;
}

export { STORE_KEY, pushAudit };
