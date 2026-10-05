import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import type {
  ClausePositionResponsibility,
  ComplianceEvaluation,
  EvaluationEvidence,
  ImportReport,
  JobDescription,
  JobDescriptionEvaluation,
  JobPosition,
  LocalDatabase,
  OrgUnit,
  Policy,
  PolicyClause,
  PolicyScopeTarget,
  PolicySection,
} from "@/lib/types";
import {
  getBundledLocalDataDir,
  getLocalDataDir,
  isReadOnlyFsError,
  readOnlyFsUserMessage,
} from "./data-paths";
import {
  decodeRemotePayload,
  loadOrgRemoteRow,
  loadRemoteRow,
  preferRemoteStore,
  REMOTE_KEYS,
  saveRemotePayload,
  saveRemotePayloadIfMatch,
} from "./remote-store";
import { getPolicyScope } from "@/lib/access/scope";

async function resolvePolicyOrganizationId(): Promise<string | null> {
  try {
    const scope = await getPolicyScope();
    const heltes = scope?.heltesId?.trim();
    return heltes || null;
  } catch {
    return null;
  }
}

function emptyDb(): LocalDatabase {
  return {
    meta: {
      imported_at: null,
      source_path: null,
      import_report: null,
    },
    users: [
      {
        id: "00000000-0000-4000-8000-000000000001",
        email: "admin@bgs.local",
        display_name: "System Admin",
        is_active: true,
      },
    ],
    org_units: [],
    policies: [],
    policy_sections: [],
    policy_clauses: [],
    job_positions: [],
    job_descriptions: [],
    job_description_evaluations: [],
    policy_scope_targets: [],
    clause_position_responsibilities: [],
    compliance_evaluations: [],
    evaluation_evidence: [],
  };
}

let writeQueue: Promise<void> = Promise.resolve();
let seeded = false;

type DbMemory = {
  db?: LocalDatabase;
  cachedAt?: number;
  readPromise?: Promise<LocalDatabase>;
};

const DB_CACHE_TTL_MS = Number(process.env.DB_CACHE_TTL_MS ?? 5_000);

function dbMemory(): DbMemory {
  const globalRef = globalThis as typeof globalThis & {
    __policyComplianceDbMemory?: DbMemory;
  };
  if (!globalRef.__policyComplianceDbMemory) {
    globalRef.__policyComplianceDbMemory = {};
  }
  return globalRef.__policyComplianceDbMemory;
}

function rememberDb(db: LocalDatabase) {
  const memory = dbMemory();
  memory.db = db;
  memory.cachedAt = Date.now();
}

export async function ensureDataDir() {
  await ensureDataDirInner();
  await seedRuntimeFiles();
}

async function ensureDataDirInner() {
  await fs.mkdir(getLocalDataDir(), { recursive: true });
}

async function seedRuntimeFiles() {
  if (seeded) return;
  seeded = true;
  const runtime = getLocalDataDir();
  const bundled = getBundledLocalDataDir();
  if (path.resolve(runtime) === path.resolve(bundled)) return;

  await fs.mkdir(runtime, { recursive: true });
  const files = [
    "db.json",
    "reference-map.json",
    "policy-org-overrides.json",
    "position-org-overrides.json",
  ];
  for (const name of files) {
    const dest = path.join(/*turbopackIgnore: true*/ runtime, name);
    try {
      await fs.access(dest);
      continue;
    } catch {
      // missing — try seed
    }
    try {
      await fs.copyFile(
        path.join(/*turbopackIgnore: true*/ bundled, name),
        dest,
      );
    } catch {
      // optional seed file
    }
  }
}

function dbPath() {
  return path.join(getLocalDataDir(), "db.json");
}

async function loadBundledDb(): Promise<LocalDatabase> {
  const bundled = path.join(getBundledLocalDataDir(), "db.json");
  try {
    const raw = await fs.readFile(bundled, "utf8");
    const db = JSON.parse(raw) as LocalDatabase;
    if (!Array.isArray(db.policies)) return emptyDb();
    return db;
  } catch {
    // data/ is gitignored — Vercel deploys often have no seed file.
    // Prefer empty in-memory DB over crashing dashboard (P0-03 safe).
    return emptyDb();
  }
}

/** Windows/serverless-safe write. */
async function writeFileReplace(filePath: string, contents: string) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`,
  );
  try {
    await fs.writeFile(tmp, contents, "utf8");
  } catch (err) {
    if (isReadOnlyFsError(err)) {
      throw new Error(readOnlyFsUserMessage());
    }
    throw err;
  }

  const maxAttempts = 8;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await fs.copyFile(tmp, filePath);
      await fs.unlink(tmp).catch(() => undefined);
      return;
    } catch (err) {
      lastError = err;
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code?: string }).code)
          : "";
      if (code === "EPERM" || code === "EBUSY" || code === "EACCES") {
        await new Promise((r) => setTimeout(r, 40 * (attempt + 1)));
        continue;
      }
      if (isReadOnlyFsError(err)) {
        await fs.unlink(tmp).catch(() => undefined);
        throw new Error(readOnlyFsUserMessage());
      }
      break;
    }
  }

  try {
    await fs.writeFile(filePath, contents, "utf8");
    await fs.unlink(tmp).catch(() => undefined);
  } catch (err) {
    await fs.unlink(tmp).catch(() => undefined);
    if (isReadOnlyFsError(err) || isReadOnlyFsError(lastError)) {
      throw new Error(readOnlyFsUserMessage());
    }
    throw lastError ?? err;
  }
}

async function readRemoteDb(): Promise<LocalDatabase> {
  const organizationId = await resolvePolicyOrganizationId();
  // Prefer org partition when embed scope is present; if the org row (or
  // org_app_data_store table) is missing, fall back to the legacy global
  // mega-row so Production keeps serving real policies until P0-03 backfill.
  let row = organizationId
    ? await loadOrgRemoteRow(organizationId, REMOTE_KEYS.db)
    : null;
  if (!row) {
    row = await loadRemoteRow(REMOTE_KEYS.db);
  }
  if (row) {
    const remote = decodeRemotePayload<LocalDatabase>(row.payload);
    if (remote && Array.isArray(remote.policies)) return remote;
    // Corrupt remote must NOT be overwritten by bundled seed.
    throw new Error("Supabase db уншиж чадсангүй (corrupt payload)");
  }

  // First boot seed requires org partition (P0-03). Without scope, serve
  // bundled DB read-only — never write an unscoped remote row.
  if (!organizationId) {
    return loadBundledDb();
  }
  const seededDb = await loadBundledDb();
  const status = await saveRemotePayloadIfMatch(
    REMOTE_KEYS.db,
    seededDb,
    null,
    organizationId,
  );
  if (status === "ok") return seededDb;
  if (status === "conflict") {
    const again = await loadOrgRemoteRow(organizationId, REMOTE_KEYS.db);
    const remote = again
      ? decodeRemotePayload<LocalDatabase>(again.payload)
      : null;
    if (remote && Array.isArray(remote.policies)) return remote;
  }
  // Org table may not exist yet — last resort global already tried above.
  throw new Error("Supabase дээр db seed хийж чадсангүй");
}

export async function readDb(): Promise<LocalDatabase> {
  if (preferRemoteStore()) {
    const memory = dbMemory();
    if (
      memory.db &&
      memory.cachedAt &&
      Date.now() - memory.cachedAt < DB_CACHE_TTL_MS
    ) {
      return memory.db;
    }
    if (memory.readPromise) return memory.readPromise;

    memory.readPromise = (async () => {
      const db = await readRemoteDb();
      rememberDb(db);
      return db;
    })().finally(() => {
      memory.readPromise = undefined;
    });
    return memory.readPromise;
  }

  await ensureDataDirInner();
  await seedRuntimeFiles();
  const file = dbPath();
  try {
    const raw = await fs.readFile(file, "utf8");
    const db = JSON.parse(raw) as LocalDatabase;
    rememberDb(db);
    return db;
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code?: string }).code)
        : "";
    if (code === "ENOENT") {
      try {
        const db = await loadBundledDb();
        try {
          await writeDb(db);
        } catch {
          // read-only — still return seed in-memory
        }
        rememberDb(db);
        return db;
      } catch {
        const db = emptyDb();
        try {
          await writeDb(db);
        } catch {
          // ignore
        }
        rememberDb(db);
        return db;
      }
    }
    throw err;
  }
}

export async function writeDb(db: LocalDatabase): Promise<void> {
  const run = writeQueue.then(async () => {
    if (preferRemoteStore()) {
      const organizationId = await resolvePolicyOrganizationId();
      // Prefer org partition when embed has heltesId; otherwise (or if org
      // table is missing) write the legacy global mega-row so Production
      // admin/full-scope edits keep working until P0-03 is fully provisioned.
      const ok = await saveRemotePayload(REMOTE_KEYS.db, db, organizationId);
      if (!ok) {
        throw new Error("Supabase дээр өгөгдөл хадгалж чадсангүй");
      }
      rememberDb(db);
      return;
    }

    await ensureDataDirInner();
    await seedRuntimeFiles();
    await writeFileReplace(dbPath(), JSON.stringify(db, null, 2));
    rememberDb(db);
  });
  writeQueue = run.catch(() => undefined);
  await run;
}

export async function replaceDb(db: LocalDatabase): Promise<void> {
  await writeDb(db);
}

export function newId(): string {
  return randomUUID();
}

export async function updateDb(
  mutator: (db: LocalDatabase) => void | Promise<void>,
): Promise<LocalDatabase> {
  // Serialize on this instance; also retry on remote conflicts across instances.
  const run = writeQueue.then(async () => {
    if (!preferRemoteStore()) {
      const db = await readDb();
      await mutator(db);
      await ensureDataDirInner();
      await seedRuntimeFiles();
      await writeFileReplace(dbPath(), JSON.stringify(db, null, 2));
      rememberDb(db);
      return db;
    }

    const maxAttempts = 6;
    let lastStatus: "ok" | "conflict" | "error" = "error";
    const organizationId = await resolvePolicyOrganizationId();
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Prefer org partition when present; otherwise use global mega-row.
      // Admin/full embeds often have no heltesId — those must write global.
      let writeOrganizationId: string | null = organizationId;
      let row = organizationId
        ? await loadOrgRemoteRow(organizationId, REMOTE_KEYS.db)
        : null;
      if (!row) {
        row = await loadRemoteRow(REMOTE_KEYS.db);
        writeOrganizationId = null;
      }

      let db: LocalDatabase;
      let expectedUpdatedAt: string | null = null;

      if (row) {
        const decoded = decodeRemotePayload<LocalDatabase>(row.payload);
        if (!decoded || !Array.isArray(decoded.policies)) {
          throw new Error("Supabase db уншиж чадсангүй (corrupt payload)");
        }
        db = decoded;
        expectedUpdatedAt = row.updatedAt;
      } else {
        db = await loadBundledDb();
        expectedUpdatedAt = null;
      }

      await mutator(db);
      lastStatus = await saveRemotePayloadIfMatch(
        REMOTE_KEYS.db,
        db,
        expectedUpdatedAt,
        writeOrganizationId,
      );
      if (lastStatus === "ok") {
        rememberDb(db);
        return db;
      }
      if (lastStatus === "error") {
        throw new Error("Supabase дээр өгөгдөл хадгалж чадсангүй");
      }
      // conflict → retry with fresh remote
      await new Promise((r) => setTimeout(r, 40 * (attempt + 1)));
    }
    throw new Error(
      `Supabase дээр зэрэг бичилт конфликт (${lastStatus}). Дахин оролдоно уу.`,
    );
  });
  writeQueue = run.then(() => undefined).catch(() => undefined);
  return run;
}

export type {
  ClausePositionResponsibility,
  ComplianceEvaluation,
  EvaluationEvidence,
  ImportReport,
  JobDescription,
  JobDescriptionEvaluation,
  JobPosition,
  LocalDatabase,
  OrgUnit,
  Policy,
  PolicyClause,
  PolicyScopeTarget,
  PolicySection,
};
