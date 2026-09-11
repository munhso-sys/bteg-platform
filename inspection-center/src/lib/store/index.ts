import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import type {
  CorrectiveAction,
  InspectionAnswer,
  AnnualPlanPeriodCounts,
  AnnualPlanRow,
  AnnualPlanTypeTarget,
  ChecklistCatalogItem,
  DocumentInspectionItem,
  FindingStatus,
  InspectionCenterData,
  InspectionEvidence,
  InspectionFinding,
  InspectionPlan,
  InspectionRun,
  InspectionScoreSnapshot,
  InspectionTemplate,
  InspectionTemplateQuestion,
  InspectionTemplateSection,
  InspectionType,
  InspectionPerformer,
  JointInspectionItem,
  JointUnitAnswerState,
  JointUnitScope,
  MasterWorkbookData,
  NightInspectionItem,
  RiskThresholds,
  RunStatus,
  Severity,
  StateInspectionProgressRow,
} from "@/lib/types";
import {
  ANNUAL_PLAN_TYPE_ORDER,
  emptyAnnualPlanTypeCounts,
  INSPECTION_TYPE_LABELS,
  normalizeAnnualPlanPeriodCounts,
  normalizeChecklistMonths,
  normalizeRiskThresholds,
  countChecklistMonthSelections,
} from "@/lib/types";
import {
  calculateRunScore,
  deriveComplianceStatus,
  mapRiskLevel,
} from "@/lib/scoring";
import {
  loadOrgRemoteRow,
  loadRemoteRow,
  REMOTE_KEYS,
  saveRemotePayload,
} from "@/lib/store/remote";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getInspectionScope } from "@/lib/access/scope";

async function resolveStoreOrganizationId(): Promise<string | null> {
  try {
    const scope = await getInspectionScope();
    const heltes = scope?.heltesId?.trim();
    return heltes || null;
  } catch {
    return null;
  }
}

/** Seed/import files shipped with the deploy (often read-only on Vercel). */
const SEED_DATA_DIR = path.join(process.cwd(), "data");
/**
 * Writable runtime dir. On Vercel the app filesystem is read-only, so persist
 * under /tmp and keep an in-memory cache so create→redirect works in-process.
 */
const IS_SERVERLESS = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME,
);
const RUNTIME_DATA_DIR = IS_SERVERLESS
  ? path.join("/tmp", "inspection-center-data")
  : SEED_DATA_DIR;

const STORE_FILE = path.join(RUNTIME_DATA_DIR, "store.json");
const STORE_SEED_FILE = path.join(SEED_DATA_DIR, "store.json");
const IMPORT_FILE = path.join(SEED_DATA_DIR, "imported-templates.json");
const MASTER_IMPORT_FILE = path.join(RUNTIME_DATA_DIR, "imported-master-sheets.json");
const MASTER_SEED_FILE = path.join(SEED_DATA_DIR, "imported-master-sheets.json");
const ANNUAL_PLAN_FILE = path.join(RUNTIME_DATA_DIR, "annual-plans.json");
const ANNUAL_PLAN_SEED_FILE = path.join(SEED_DATA_DIR, "annual-plans.json");
const ANNUAL_PLAN_TYPE_FILE = path.join(
  RUNTIME_DATA_DIR,
  "annual-plan-by-type.json",
);
const ANNUAL_PLAN_TYPE_SEED_FILE = path.join(
  SEED_DATA_DIR,
  "annual-plan-by-type.json",
);

type StoreMemory = {
  store?: InspectionCenterData;
  annualPlans?: AnnualPlanRow[];
  annualPlanTypes?: AnnualPlanTypeTarget[];
  storeUpdatedAt?: string;
  annualPlansUpdatedAt?: string;
  annualPlanTypesUpdatedAt?: string;
  /** Last successful remote/local hydrate time (ms). Used to skip re-fetch. */
  hydratedAt?: number;
  hydratePromise?: Promise<void>;
  /** One-shot per warm instance: expand run violations into findings/actions. */
  findingsLinkedAt?: number;
  remoteWrites?: Promise<unknown>[];
  /** Latest payload per remote key — coalesces burst writes into one upsert. */
  pendingRemotePayload?: Map<string, unknown>;
  remoteWriteScheduled?: Set<string>;
};

/** Skip remote re-hydrate within this window when memory already has data. */
const HYDRATE_TTL_MS = Number(process.env.STORE_HYDRATE_TTL_MS ?? 60_000);
const HYDRATE_TIMEOUT_MS = Number(process.env.STORE_HYDRATE_TIMEOUT_MS ?? 12_000);

function storeMemory(): StoreMemory {
  const globalRef = globalThis as typeof globalThis & {
    __inspectionCenterMemory?: StoreMemory;
  };
  if (!globalRef.__inspectionCenterMemory) {
    globalRef.__inspectionCenterMemory = { remoteWrites: [] };
  }
  if (!globalRef.__inspectionCenterMemory.remoteWrites) {
    globalRef.__inspectionCenterMemory.remoteWrites = [];
  }
  return globalRef.__inspectionCenterMemory;
}

function isRemoteNewer(remoteUpdatedAt: string, localUpdatedAt?: string) {
  if (!remoteUpdatedAt) return false;
  if (!localUpdatedAt) return true;
  return remoteUpdatedAt >= localUpdatedAt;
}

function fileUpdatedAt(filePath: string): string | undefined {
  try {
    if (!fs.existsSync(filePath)) return undefined;
    return fs.statSync(filePath).mtime.toISOString();
  } catch {
    return undefined;
  }
}

function newestStamp(...stamps: (string | undefined)[]) {
  return stamps.filter((value): value is string => Boolean(value)).sort().at(-1);
}

function normalizeStoreData(data: InspectionCenterData): InspectionCenterData {
  return {
    ...emptyData(),
    ...data,
    riskThresholds: normalizeRiskThresholds(data.riskThresholds),
  };
}

function queueRemoteWrite(
  key: (typeof REMOTE_KEYS)[keyof typeof REMOTE_KEYS],
  payload: unknown,
  touch?: (updatedAt: string) => void,
) {
  if (!isSupabaseConfigured()) return;
  // Local/dev: disk is authoritative — don't block saves on multi-MB remote upserts.
  if (preferLocalStore()) return;

  const memory = storeMemory();
  const updatedAt = new Date().toISOString();
  touch?.(updatedAt);

  if (!memory.pendingRemotePayload) memory.pendingRemotePayload = new Map();
  if (!memory.remoteWriteScheduled) memory.remoteWriteScheduled = new Set();
  memory.pendingRemotePayload.set(key, payload);

  // Coalesce: one in-flight upsert per key; always send the latest payload.
  if (memory.remoteWriteScheduled.has(key)) return;
  memory.remoteWriteScheduled.add(key);

  const task = Promise.resolve()
    .then(async () => {
      const latest = memory.pendingRemotePayload?.get(key);
      memory.pendingRemotePayload?.delete(key);
      memory.remoteWriteScheduled?.delete(key);
      if (latest === undefined) return;
      const organizationId = await resolveStoreOrganizationId();
      if (!organizationId) {
        console.warn(
          `[store] refused unscoped remote write for ${key} (P0-03)`,
        );
        return;
      }
      await saveRemotePayload(key, latest, organizationId);
    })
    .catch((error) => {
      console.warn(`[store] remote write failed (${key}):`, error);
    });

  memory.remoteWrites?.push(task);
  void task.finally(() => {
    const list = memory.remoteWrites;
    if (!list) return;
    const index = list.indexOf(task);
    if (index >= 0) list.splice(index, 1);
  });
}

function preferLocalStore() {
  return (
    process.env.STORE_PREFER_LOCAL === "1" ||
    process.env.NODE_ENV === "development"
  );
}

/**
 * Refresh shared state from Supabase when memory is cold or TTL expired.
 * Warm instances skip multi-MB re-download within STORE_HYDRATE_TTL_MS (default 60s).
 */
export async function ensureStoreHydrated() {
  const memory = storeMemory();
  if (memory.hydratePromise) {
    await memory.hydratePromise;
    linkFindingsFromRunsIfNeeded();
    return;
  }

  // Local mutations in-flight are authoritative until flushed.
  if (memory.remoteWrites && memory.remoteWrites.length > 0) {
    linkFindingsFromRunsIfNeeded();
    return;
  }

  // Warm cache: avoid full remote pull on every layout/navigation.
  if (
    memory.store &&
    memory.hydratedAt &&
    Date.now() - memory.hydratedAt < HYDRATE_TTL_MS
  ) {
    linkFindingsFromRunsIfNeeded();
    return;
  }

  memory.hydratePromise = (async () => {
    if (!isSupabaseConfigured()) {
      if (!memory.store) {
        memory.store = readStore();
        memory.hydratedAt = Date.now();
        memory.findingsLinkedAt = undefined;
      }
      return;
    }

    const localOnly = preferLocalStore();
    const diskStore = readJsonFile<InspectionCenterData>(
      STORE_FILE,
      STORE_SEED_FILE,
    );
    const localStoreStamp = newestStamp(
      memory.storeUpdatedAt,
      fileUpdatedAt(STORE_FILE),
    );

    // Localhost/dev: always trust data/store.json so new findings stay visible.
    // Do not pull remote over local (that was wiping freshly saved violations).
    if (localOnly) {
      const diskStamp = fileUpdatedAt(STORE_FILE);
      if (diskStore) {
        if (
          !memory.store ||
          (diskStamp &&
            (!memory.storeUpdatedAt || diskStamp > memory.storeUpdatedAt))
        ) {
          memory.store = normalizeStoreData(diskStore);
          memory.storeUpdatedAt = diskStamp ?? new Date().toISOString();
          memory.findingsLinkedAt = undefined;
        }
      } else if (!memory.store) {
        memory.store = readStore();
        memory.findingsLinkedAt = undefined;
      }

      const diskPlans = readJsonFile<AnnualPlanRow[]>(
        ANNUAL_PLAN_FILE,
        ANNUAL_PLAN_SEED_FILE,
      );
      const plansStamp = fileUpdatedAt(ANNUAL_PLAN_FILE);
      if (
        diskPlans &&
        (!memory.annualPlans ||
          (plansStamp &&
            (!memory.annualPlansUpdatedAt ||
              plansStamp > memory.annualPlansUpdatedAt)))
      ) {
        memory.annualPlans = diskPlans;
        memory.annualPlansUpdatedAt = plansStamp;
      }

      const diskTypes = readJsonFile<AnnualPlanTypeTarget[]>(
        ANNUAL_PLAN_TYPE_FILE,
        ANNUAL_PLAN_TYPE_SEED_FILE,
      );
      const typesStamp = fileUpdatedAt(ANNUAL_PLAN_TYPE_FILE);
      if (
        diskTypes &&
        (!memory.annualPlanTypes ||
          (typesStamp &&
            (!memory.annualPlanTypesUpdatedAt ||
              typesStamp > memory.annualPlanTypesUpdatedAt)))
      ) {
        memory.annualPlanTypes = diskTypes;
        memory.annualPlanTypesUpdatedAt = typesStamp;
      }
      memory.hydratedAt = Date.now();
      return;
    }

    const organizationId = await resolveStoreOrganizationId();
    const remoteLoad = organizationId
      ? Promise.all([
          loadOrgRemoteRow<InspectionCenterData>(
            organizationId,
            REMOTE_KEYS.store,
          ),
          loadOrgRemoteRow<AnnualPlanRow[]>(
            organizationId,
            REMOTE_KEYS.annualPlans,
          ),
          loadOrgRemoteRow<AnnualPlanTypeTarget[]>(
            organizationId,
            REMOTE_KEYS.annualPlanTypes,
          ),
        ])
      : Promise.all([
          // Legacy read-only fallback when no unit scope (admin full mode).
          loadRemoteRow<InspectionCenterData>(REMOTE_KEYS.store),
          loadRemoteRow<AnnualPlanRow[]>(REMOTE_KEYS.annualPlans),
          loadRemoteRow<AnnualPlanTypeTarget[]>(REMOTE_KEYS.annualPlanTypes),
        ]);

    const timed = await Promise.race([
      remoteLoad.then((rows) => ({ ok: true as const, rows })),
      new Promise<{ ok: false }>((resolve) =>
        setTimeout(() => resolve({ ok: false }), HYDRATE_TIMEOUT_MS),
      ),
    ]);

    if (!timed.ok) {
      console.warn(
        `[store] hydrate timed out after ${HYDRATE_TIMEOUT_MS}ms; using local/memory`,
      );
      if (!memory.store) {
        memory.store = readStore();
        memory.findingsLinkedAt = undefined;
      }
      memory.hydratedAt = Date.now();
      return;
    }

    const [remoteStore, remotePlans, remoteTypes] = timed.rows;

    if (
      remoteStore &&
      isRemoteNewer(remoteStore.updatedAt, localStoreStamp)
    ) {
      memory.store = normalizeStoreData(remoteStore.payload);
      memory.storeUpdatedAt = remoteStore.updatedAt;
      memory.findingsLinkedAt = undefined;
      writeJsonFile(STORE_FILE, remoteStore.payload);
    } else if (
      memory.store &&
      (!remoteStore ||
        Boolean(localStoreStamp && localStoreStamp > remoteStore.updatedAt))
    ) {
      if (organizationId) {
        await saveRemotePayload(REMOTE_KEYS.store, memory.store, organizationId);
      }
    } else if (!memory.store) {
      memory.store = diskStore
        ? normalizeStoreData(diskStore)
        : readStore();
      memory.findingsLinkedAt = undefined;
    }

    const localPlansStamp = newestStamp(
      memory.annualPlansUpdatedAt,
      fileUpdatedAt(ANNUAL_PLAN_FILE),
    );
    if (
      remotePlans &&
      isRemoteNewer(remotePlans.updatedAt, localPlansStamp)
    ) {
      memory.annualPlans = remotePlans.payload;
      memory.annualPlansUpdatedAt = remotePlans.updatedAt;
      writeJsonFile(ANNUAL_PLAN_FILE, remotePlans.payload);
    } else if (
      memory.annualPlans &&
      (!remotePlans ||
        Boolean(localPlansStamp && localPlansStamp > remotePlans.updatedAt))
    ) {
      if (organizationId) {
        await saveRemotePayload(
          REMOTE_KEYS.annualPlans,
          memory.annualPlans,
          organizationId,
        );
      }
    }

    const localTypesStamp = newestStamp(
      memory.annualPlanTypesUpdatedAt,
      fileUpdatedAt(ANNUAL_PLAN_TYPE_FILE),
    );
    if (
      remoteTypes &&
      isRemoteNewer(remoteTypes.updatedAt, localTypesStamp)
    ) {
      memory.annualPlanTypes = remoteTypes.payload;
      memory.annualPlanTypesUpdatedAt = remoteTypes.updatedAt;
      writeJsonFile(ANNUAL_PLAN_TYPE_FILE, remoteTypes.payload);
    } else if (
      memory.annualPlanTypes &&
      (!remoteTypes ||
        Boolean(localTypesStamp && localTypesStamp > remoteTypes.updatedAt))
    ) {
      if (organizationId) {
        await saveRemotePayload(
          REMOTE_KEYS.annualPlanTypes,
          memory.annualPlanTypes,
          organizationId,
        );
      }
    }

    memory.hydratedAt = Date.now();
  })();

  try {
    await memory.hydratePromise;
  } finally {
    memory.hydratePromise = undefined;
  }
  linkFindingsFromRunsIfNeeded();
}

const FLUSH_TIMEOUT_MS = Number(process.env.STORE_FLUSH_TIMEOUT_MS ?? 25_000);

/** Wait for queued Supabase writes so the next instance can read fresh data. */
export async function flushPendingStoreWrites() {
  const memory = storeMemory();
  const started = Date.now();
  while (memory.remoteWrites && memory.remoteWrites.length > 0) {
    if (Date.now() - started > FLUSH_TIMEOUT_MS) {
      console.warn(
        `[store] flush timed out after ${FLUSH_TIMEOUT_MS}ms; continuing without waiting`,
      );
      memory.remoteWrites.length = 0;
      break;
    }
    const pending = [...memory.remoteWrites];
    await Promise.race([
      Promise.all(pending),
      new Promise<void>((resolve) => setTimeout(resolve, 5_000)),
    ]);
  }
}

const PLAN_FLUSH_TIMEOUT_MS = Number(
  process.env.STORE_PLAN_FLUSH_TIMEOUT_MS ?? 12_000,
);

/**
 * Persist annual-plan slices quickly without blocking on the multi-MB
 * `inspection_center_store` remote upsert (that made «Баталгаажуулах» hang).
 */
export async function flushPlanRemoteWrites(
  timeoutMs = PLAN_FLUSH_TIMEOUT_MS,
) {
  if (!isSupabaseConfigured() || preferLocalStore()) return;

  const memory = storeMemory();
  const writes: Promise<unknown>[] = [];

  const plansPayload =
    memory.pendingRemotePayload?.get(REMOTE_KEYS.annualPlans) ??
    memory.annualPlans;
  const typesPayload =
    memory.pendingRemotePayload?.get(REMOTE_KEYS.annualPlanTypes) ??
    memory.annualPlanTypes;

  if (plansPayload !== undefined) {
    memory.pendingRemotePayload?.delete(REMOTE_KEYS.annualPlans);
    const organizationId = await resolveStoreOrganizationId();
    if (organizationId) {
      writes.push(
        saveRemotePayload(
          REMOTE_KEYS.annualPlans,
          plansPayload,
          organizationId,
        ),
      );
    } else {
      console.warn("[store] refused unscoped annualPlans flush (P0-03)");
    }
  }
  if (typesPayload !== undefined) {
    memory.pendingRemotePayload?.delete(REMOTE_KEYS.annualPlanTypes);
    const organizationId = await resolveStoreOrganizationId();
    if (organizationId) {
      writes.push(
        saveRemotePayload(
          REMOTE_KEYS.annualPlanTypes,
          typesPayload,
          organizationId,
        ),
      );
    } else {
      console.warn("[store] refused unscoped annualPlanTypes flush (P0-03)");
    }
  }

  if (writes.length === 0) return;

  await Promise.race([
    Promise.all(writes),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}

/** Use around mutations in server actions / route handlers. */
export async function runStoreMutation<T>(fn: () => T): Promise<T> {
  await ensureStoreHydrated();
  try {
    return fn();
  } finally {
    await flushPendingStoreWrites();
  }
}

/**
 * Plan / by-type saves: hydrate → mutate → flush small plan keys only.
 * Full store remote upsert continues in the background (not awaited).
 */
export async function runPlanStoreMutation<T>(fn: () => T): Promise<T> {
  await ensureStoreHydrated();
  try {
    return fn();
  } finally {
    await flushPlanRemoteWrites();
  }
}

function emptyData(): InspectionCenterData {
  return {
    templates: [],
    sections: [],
    questions: [],
    plans: [],
    runs: [],
    answers: [],
    findings: [],
    actions: [],
    evidence: [],
    scoreSnapshots: [],
    riskThresholds: normalizeRiskThresholds(null),
  };
}

function ensureRuntimeDir() {
  try {
    fs.mkdirSync(RUNTIME_DATA_DIR, { recursive: true });
  } catch {
    // Read-only environments: memory cache still allows the request to proceed.
  }
}

/** @deprecated use ensureRuntimeDir — kept for call sites during migration */
function ensureDir() {
  ensureRuntimeDir();
}

function readJsonFile<T>(...candidates: string[]): T | null {
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        return JSON.parse(fs.readFileSync(file, "utf8")) as T;
      }
    } catch (error) {
      console.warn(`[store] Failed to read ${file}:`, error);
    }
  }
  return null;
}

function writeJsonFile(file: string, data: unknown): boolean {
  ensureRuntimeDir();
  try {
    const payload = IS_SERVERLESS
      ? JSON.stringify(data)
      : JSON.stringify(data, null, 2);
    fs.writeFileSync(file, payload, "utf8");
    return true;
  } catch (error) {
    console.warn(`[store] Failed to write ${file}:`, error);
    return false;
  }
}

function stableRowId(prefix: string, row: { sourceSheetName?: string; sourceRow?: number; sequence?: number }) {
  return [
    prefix,
    row.sourceSheetName ?? "manual",
    row.sourceRow ?? row.sequence ?? randomUUID(),
  ]
    .join("-")
    .replace(/[^a-zA-Z0-9_-]/g, "_");
}

function loadImportedTemplates(): Pick<
  InspectionCenterData,
  "templates" | "sections" | "questions"
> {
  if (!fs.existsSync(IMPORT_FILE)) {
    return { templates: [], sections: [], questions: [] };
  }
  const raw = JSON.parse(fs.readFileSync(IMPORT_FILE, "utf8")) as {
    templates: InspectionTemplate[];
    sections: InspectionTemplateSection[];
    questions: InspectionTemplateQuestion[];
  };
  return {
    templates: raw.templates ?? [],
    sections: raw.sections ?? [],
    questions: raw.questions ?? [],
  };
}

function seedDemo(
  base: InspectionCenterData,
): InspectionCenterData {
  if (base.runs.length > 0) return base;
  if (base.templates.length === 0) return base;

  const template =
    base.templates.find((t) => t.code === "6.1") ?? base.templates[0];
  const questions = base.questions
    .filter((q) => q.templateId === template.id && q.active)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  const now = new Date().toISOString();
  const plan: InspectionPlan = {
    id: randomUUID(),
    title: `${template.code} — 2026 оны төлөвлөгөөт шалгалт`,
    inspectionType: "CHECKLIST",
    year: 2026,
    month: 4,
    plannedDate: "2026-04-15",
    targetOrgUnitId: "org-demo-1",
    targetDepartmentId: "dept-mining",
    targetLocationId: "loc-site-a",
    responsibleTeamId: "team-dhsh",
    status: "in_progress",
    notes: "Demo plan seeded from imported Excel templates",
    createdAt: now,
    updatedAt: now,
  };

  const run: InspectionRun = {
    id: randomUUID(),
    planId: plan.id,
    templateId: template.id,
    inspectionType: "CHECKLIST",
    title: `${template.code} ${template.title}`,
    inspectedByOrg: "ДХШ",
    inspectionDate: "2026-04-23",
    dueDate: "2026-04-30",
    completedDate: null,
    targetOrgUnitId: "org-demo-1",
    targetDepartmentId: "dept-mining",
    targetLocationId: "loc-site-a",
    leadInspectorId: "inspector-1",
    status: "in_progress",
    notes: "",
    createdAt: now,
    updatedAt: now,
  };

    const answers: InspectionAnswer[] = questions.map((q, idx) => {
    const fail = idx % 7 === 0;
    const isApplicable = idx % 11 !== 0;
    const receivedScore = !isApplicable || !fail ? 0 : q.approvedScore;
    return {
      id: randomUUID(),
      runId: run.id,
      templateQuestionId: q.id,
      isApplicable,
      approvedScore: q.approvedScore,
      receivedScore,
      complianceStatus: deriveComplianceStatus(
        isApplicable,
        q.approvedScore,
        receivedScore,
      ),
      comment: fail ? "Шаардлага хангаагүй — зөрчил бүртгэв" : "",
      answeredBy: "inspector-1",
      answeredAt: now,
    };
  });

  const score = calculateRunScore(answers, base.riskThresholds);
  const snapshot: InspectionScoreSnapshot = {
    id: randomUUID(),
    runId: run.id,
    ...score,
    calculatedAt: now,
  };

  const findings: InspectionFinding[] = [];
  const actions: CorrectiveAction[] = [];
  const evidence: InspectionEvidence[] = [];

  for (const answer of answers) {
    if (answer.complianceStatus !== "fail" && answer.complianceStatus !== "partial") {
      continue;
    }
    const q = questions.find((x) => x.id === answer.templateQuestionId);
    const finding: InspectionFinding = {
      id: randomUUID(),
      runId: run.id,
      answerId: answer.id,
      findingType: "violation",
      severity: answer.complianceStatus === "fail" ? "high" : "medium",
      title: q
        ? `Зөрчил: ${q.questionNo} — ${q.questionText.slice(0, 80)}`
        : "Зөрчил",
      description: answer.comment || q?.questionText || "",
      sourceText: q?.legalReference || "",
      targetOrgUnitId: run.targetOrgUnitId,
      targetDepartmentId: run.targetDepartmentId,
      targetJobPositionId: null,
      policyClauseId: null,
      status: "open",
      createdAt: now,
      updatedAt: now,
    };
    findings.push(finding);

    const action: CorrectiveAction = {
      id: randomUUID(),
      findingId: finding.id,
      actionText: "Зөрчлийг арилгах арга хэмжээ хэрэгжүүлэх",
      responsibleEmployeeId: "emp-1",
      responsibleJobPositionId: null,
      responsibleOrgUnitId: run.targetOrgUnitId,
      progressPercent: 25,
      startDate: now.slice(0, 10),
      dueDate: "2026-05-31",
      completedDate: null,
      status: "in_progress",
      managerComment: "",
      createdAt: now,
      updatedAt: now,
    };
    actions.push(action);

    evidence.push({
      id: randomUUID(),
      runId: run.id,
      answerId: answer.id,
      findingId: finding.id,
      actionId: action.id,
      fileUrl: `/evidence/demo-${finding.id.slice(0, 8)}.pdf`,
      fileType: "application/pdf",
      caption: "Зөрчлийн баримт",
      uploadedBy: "inspector-1",
      uploadedAt: now,
    });
  }

  return {
    ...base,
    plans: [plan],
    runs: [run],
    answers,
    findings,
    actions,
    evidence,
    scoreSnapshots: [snapshot],
  };
}

function buildMasterTemplateQuestions(
  templateId: string,
  inspectionType: "JOINT_INSPECTION" | "NIGHT_INSPECTION",
  master: MasterWorkbookData,
): InspectionTemplateQuestion[] {
  if (inspectionType === "JOINT_INSPECTION") {
    return master.jointInspectionItems.map((item, index) => ({
      id: stableRowId("template-joint", item),
      templateId,
      sectionId: null,
      questionNo: String(item.sequence || index + 1),
      legalReference: item.category,
      questionText: item.item,
      approvedScore: Number(item.maxScore) || 1,
      orderIndex: index + 1,
      active: true,
      sourceSheetName: item.sourceSheetName,
      sourceCellRef: item.sourceRow ? `row:${item.sourceRow}` : undefined,
      rawText: item.category,
    }));
  }

  return master.nightInspectionItems.map((item, index) => ({
    id: stableRowId("template-night", item),
    templateId,
    sectionId: null,
    questionNo: String(item.sequence || index + 1),
    legalReference: [item.area, item.sectionNo].filter(Boolean).join(" / "),
    questionText: [item.sectionTitle, item.item, item.note]
      .filter(Boolean)
      .join(" - "),
    approvedScore: 1,
    orderIndex: index + 1,
    active: true,
    sourceSheetName: item.sourceSheetName,
    sourceCellRef: item.sourceRow ? `row:${item.sourceRow}` : undefined,
    rawText: item.area,
  }));
}

function ensureMasterFormTemplates(data: InspectionCenterData): InspectionCenterData {
  const master = readMasterWorkbook();
  const now = new Date().toISOString();
  const configs: Array<{
    id: string;
    code: string;
    inspectionType: "JOINT_INSPECTION" | "NIGHT_INSPECTION";
    questionCount: number;
    sourceSheetName: string;
  }> = [
    {
      id: "master-template-joint-inspection",
      code: "JOINT",
      inspectionType: "JOINT_INSPECTION",
      questionCount: master.jointInspectionItems.length,
      sourceSheetName: "ХШХамтарсан",
    },
    {
      id: "master-template-night-inspection",
      code: "NIGHT",
      inspectionType: "NIGHT_INSPECTION",
      questionCount: master.nightInspectionItems.length,
      sourceSheetName: "ХШШөнийн",
    },
  ];

  let next = data;
  for (const config of configs) {
    if (config.questionCount === 0) continue;

    const existing = next.templates.find((template) => template.id === config.id);
    const template: InspectionTemplate = {
      id: config.id,
      code: existing?.code ?? config.code,
      title: existing?.title ?? INSPECTION_TYPE_LABELS[config.inspectionType],
      category: existing?.category ?? INSPECTION_TYPE_LABELS[config.inspectionType],
      sourceSheetName: existing?.sourceSheetName ?? config.sourceSheetName,
      regulatorySource: existing?.regulatorySource ?? "Үндсэн хүснэгтүүд",
      active: existing?.active ?? true,
      version: existing?.version ?? 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: existing?.updatedAt ?? now,
    };
    const questions = buildMasterTemplateQuestions(
      config.id,
      config.inspectionType,
      master,
    );

    next = {
      ...next,
      templates: existing
        ? next.templates.map((row) => (row.id === template.id ? template : row))
        : [template, ...next.templates],
      questions: [
        ...next.questions.filter((question) => question.templateId !== config.id),
        ...questions,
      ],
    };
  }

  return next;
}

export function readStore(): InspectionCenterData {
  const memory = storeMemory();
  if (memory.store) {
    return memory.store;
  }

  const fromDisk = readJsonFile<InspectionCenterData>(STORE_FILE, STORE_SEED_FILE);
  if (!fromDisk) {
    const imported = loadImportedTemplates();
    const seeded = seedDemo(
      ensureMasterFormTemplates({ ...emptyData(), ...imported }),
    );
    writeStore(seeded);
    return seeded;
  }

  const normalized = {
    ...emptyData(),
    ...fromDisk,
    riskThresholds: normalizeRiskThresholds(fromDisk.riskThresholds),
  };
  const withMasterTemplates = ensureMasterFormTemplates(normalized);
  if (
    withMasterTemplates.templates.length !== normalized.templates.length ||
    withMasterTemplates.questions.length !== normalized.questions.length
  ) {
    writeStore(withMasterTemplates);
  } else {
    memory.store = withMasterTemplates;
  }
  return withMasterTemplates;
}

export function writeStore(data: InspectionCenterData) {
  const memory = storeMemory();
  memory.store = data;
  memory.hydratedAt = Date.now();
  writeJsonFile(STORE_FILE, data);
  queueRemoteWrite(REMOTE_KEYS.store, data, (updatedAt) => {
    memory.storeUpdatedAt = updatedAt;
  });
}

export type StoreClearSection =
  | "execution"
  | "legacyPlans"
  | "annualPlans"
  | "annualPlanTypes";

export type StoreClearResult = {
  cleared: StoreClearSection[];
  counts: Partial<Record<StoreClearSection, number>>;
};

/**
 * Selectively wipe operational store data. Never removes templates,
 * sections, questions, risk thresholds, master workbook, or org links.
 */
export function clearInspectionStoreSections(
  sections: StoreClearSection[],
): StoreClearResult {
  const selected = new Set(sections);
  const counts: StoreClearResult["counts"] = {};
  const cleared: StoreClearSection[] = [];

  if (selected.has("execution")) {
    const data = readStore();
    counts.execution =
      data.runs.length +
      data.answers.length +
      data.findings.length +
      data.actions.length +
      data.evidence.length +
      data.scoreSnapshots.length;
    writeStore({
      ...data,
      runs: [],
      answers: [],
      findings: [],
      actions: [],
      evidence: [],
      scoreSnapshots: [],
    });
    storeMemory().findingsLinkedAt = undefined;
    cleared.push("execution");
  }

  if (selected.has("legacyPlans")) {
    const data = readStore();
    counts.legacyPlans = data.plans.length;
    writeStore({ ...data, plans: [] });
    cleared.push("legacyPlans");
  }

  if (selected.has("annualPlans")) {
    const rows = readAnnualPlans();
    counts.annualPlans = rows.length;
    writeAnnualPlans([]);
    cleared.push("annualPlans");
  }

  if (selected.has("annualPlanTypes")) {
    const rows = readAnnualPlanTypeTargets();
    counts.annualPlanTypes = rows.length;
    writeAnnualPlanTypeTargets([]);
    cleared.push("annualPlanTypes");
  }

  return { cleared, counts };
}

/** Build a JSON-serializable backup of selected store sections (for download). */
export function exportInspectionStoreSections(sections: StoreClearSection[]) {
  const selected = new Set(sections);
  const data = readStore();
  const exportedAt = new Date().toISOString();
  const payload: Record<string, unknown> = {
    exportedAt,
    app: "inspection-center",
    sections: [...selected],
  };

  if (selected.has("execution")) {
    payload.execution = {
      runs: data.runs,
      answers: data.answers,
      findings: data.findings,
      actions: data.actions,
      evidence: data.evidence,
      scoreSnapshots: data.scoreSnapshots,
    };
  }
  if (selected.has("legacyPlans")) {
    payload.legacyPlans = data.plans;
  }
  if (selected.has("annualPlans")) {
    payload.annualPlans = readAnnualPlans();
  }
  if (selected.has("annualPlanTypes")) {
    payload.annualPlanTypes = readAnnualPlanTypeTargets();
  }

  return payload;
}

/**
 * Restore selected sections from an export payload produced by
 * `exportInspectionStoreSections`. Replaces those sections only;
 * templates / master / org links / risk thresholds stay untouched.
 */
export function importInspectionStoreSections(
  payload: unknown,
  sections: StoreClearSection[],
): StoreClearResult {
  if (!payload || typeof payload !== "object") {
    throw new Error("JSON бүтэц буруу байна.");
  }
  const body = payload as Record<string, unknown>;
  if (body.app != null && body.app !== "inspection-center") {
    throw new Error(
      `Энэ файл inspection-center-ийн нөөц биш (app=${String(body.app)}).`,
    );
  }

  const selected = new Set(sections);
  const counts: StoreClearResult["counts"] = {};
  const cleared: StoreClearSection[] = [];

  if (selected.has("execution")) {
    const execution = body.execution;
    if (!execution || typeof execution !== "object") {
      throw new Error("Файлаас execution хэсэг олдсонгүй.");
    }
    const ex = execution as Record<string, unknown>;
    const data = readStore();
    const next = {
      ...data,
      runs: Array.isArray(ex.runs) ? ex.runs : [],
      answers: Array.isArray(ex.answers) ? ex.answers : [],
      findings: Array.isArray(ex.findings) ? ex.findings : [],
      actions: Array.isArray(ex.actions) ? ex.actions : [],
      evidence: Array.isArray(ex.evidence) ? ex.evidence : [],
      scoreSnapshots: Array.isArray(ex.scoreSnapshots) ? ex.scoreSnapshots : [],
    };
    writeStore(next as typeof data);
    storeMemory().findingsLinkedAt = undefined;
    counts.execution =
      next.runs.length +
      next.answers.length +
      next.findings.length +
      next.actions.length +
      next.evidence.length +
      next.scoreSnapshots.length;
    cleared.push("execution");
  }

  if (selected.has("legacyPlans")) {
    if (!("legacyPlans" in body)) {
      throw new Error("Файлаас legacyPlans хэсэг олдсонгүй.");
    }
    const data = readStore();
    const plans = Array.isArray(body.legacyPlans) ? body.legacyPlans : [];
    writeStore({ ...data, plans: plans as typeof data.plans });
    counts.legacyPlans = plans.length;
    cleared.push("legacyPlans");
  }

  if (selected.has("annualPlans")) {
    if (!("annualPlans" in body)) {
      throw new Error("Файлаас annualPlans хэсэг олдсонгүй.");
    }
    const rows = Array.isArray(body.annualPlans) ? body.annualPlans : [];
    writeAnnualPlans(rows as ReturnType<typeof readAnnualPlans>);
    counts.annualPlans = rows.length;
    cleared.push("annualPlans");
  }

  if (selected.has("annualPlanTypes")) {
    if (!("annualPlanTypes" in body)) {
      throw new Error("Файлаас annualPlanTypes хэсэг олдсонгүй.");
    }
    const rows = Array.isArray(body.annualPlanTypes) ? body.annualPlanTypes : [];
    writeAnnualPlanTypeTargets(
      rows as ReturnType<typeof readAnnualPlanTypeTargets>,
    );
    counts.annualPlanTypes = rows.length;
    cleared.push("annualPlanTypes");
  }

  if (cleared.length === 0) {
    throw new Error("Сэргээх хэсэг сонгоогүй эсвэл файлд байхгүй.");
  }

  return { cleared, counts };
}

export function readMasterWorkbook(): MasterWorkbookData {
  const raw = readJsonFile<MasterWorkbookData>(
    MASTER_IMPORT_FILE,
    MASTER_SEED_FILE,
  );
  if (!raw) {
    return {
      checklistCatalog: [],
      jointInspectionItems: [],
      stateInspectionRows: [],
      nightInspectionItems: [],
      documentInspectionItems: [],
    };
  }
  return {
    ...raw,
    checklistCatalog: (raw.checklistCatalog ?? []).map((row) => ({
      ...row,
      id: row.id ?? stableRowId("catalog", row),
    })),
    jointInspectionItems: (raw.jointInspectionItems ?? []).map((row) => ({
      ...row,
      id: row.id ?? stableRowId("joint", row),
    })),
    stateInspectionRows: (raw.stateInspectionRows ?? []).map((row) => ({
      ...row,
      id: row.id ?? stableRowId("state", row),
    })),
    nightInspectionItems: (raw.nightInspectionItems ?? []).map((row) => ({
      ...row,
      id: row.id ?? stableRowId("night", row),
    })),
    documentInspectionItems: (raw.documentInspectionItems ?? []).map((row) => ({
      ...row,
      id: row.id ?? stableRowId("document", row),
    })),
  };
}

export function writeMasterWorkbook(data: MasterWorkbookData) {
  writeJsonFile(MASTER_IMPORT_FILE, data);
  queueRemoteWrite(REMOTE_KEYS.master, data);
}

function nextSequence<T extends { sequence: number }>(rows: T[]) {
  return rows.reduce((max, row) => Math.max(max, Number(row.sequence) || 0), 0) + 1;
}

export function upsertChecklistCatalogItem(input: Partial<ChecklistCatalogItem> & { id?: string }) {
  const data = readMasterWorkbook();
  const nowRow: ChecklistCatalogItem = {
    id: input.id || randomUUID(),
    sequence: Number(input.sequence) || nextSequence(data.checklistCatalog),
    department: input.department ?? "",
    orgUnit: input.orgUnit ?? "",
    code: input.code ?? "",
    title: input.title ?? "",
    sourceSheetName: "ХШХ-1",
    sourceRow: input.sourceRow,
  };
  writeMasterWorkbook({
    ...data,
    checklistCatalog: input.id
      ? data.checklistCatalog.map((row) => (row.id === input.id ? { ...row, ...nowRow } : row))
      : [...data.checklistCatalog, nowRow],
  });
}

export function deleteChecklistCatalogItem(id: string) {
  const data = readMasterWorkbook();
  writeMasterWorkbook({
    ...data,
    checklistCatalog: data.checklistCatalog.filter((row) => row.id !== id),
  });
}

export function upsertJointInspectionItem(input: Partial<JointInspectionItem> & { id?: string }) {
  const data = readMasterWorkbook();
  const row: JointInspectionItem = {
    id: input.id || randomUUID(),
    sequence: Number(input.sequence) || nextSequence(data.jointInspectionItems),
    category: input.category ?? "",
    item: input.item ?? "",
    maxScore: input.maxScore == null ? null : Number(input.maxScore),
    score: input.score == null ? null : Number(input.score),
    sourceSheetName: "ХШХамтарсан",
    sourceRow: input.sourceRow,
  };
  writeMasterWorkbook({
    ...data,
    jointInspectionItems: input.id
      ? data.jointInspectionItems.map((x) => (x.id === input.id ? { ...x, ...row } : x))
      : [...data.jointInspectionItems, row],
  });
}

export function deleteJointInspectionItem(id: string) {
  const data = readMasterWorkbook();
  writeMasterWorkbook({
    ...data,
    jointInspectionItems: data.jointInspectionItems.filter((row) => row.id !== id),
  });
}

export function upsertNightInspectionItem(input: Partial<NightInspectionItem> & { id?: string }) {
  const data = readMasterWorkbook();
  const row: NightInspectionItem = {
    id: input.id || randomUUID(),
    sequence: Number(input.sequence) || nextSequence(data.nightInspectionItems),
    area: input.area ?? "",
    sectionNo: input.sectionNo ?? "",
    sectionTitle: input.sectionTitle ?? "",
    item: input.item ?? "",
    note: input.note ?? "",
    sourceSheetName: "ХШШөнийн",
    sourceRow: input.sourceRow,
  };
  writeMasterWorkbook({
    ...data,
    nightInspectionItems: input.id
      ? data.nightInspectionItems.map((x) => (x.id === input.id ? { ...x, ...row } : x))
      : [...data.nightInspectionItems, row],
  });
}

export function deleteNightInspectionItem(id: string) {
  const data = readMasterWorkbook();
  writeMasterWorkbook({
    ...data,
    nightInspectionItems: data.nightInspectionItems.filter((row) => row.id !== id),
  });
}

export function upsertDocumentInspectionItem(input: Partial<DocumentInspectionItem> & { id?: string }) {
  const data = readMasterWorkbook();
  const existing = input.id
    ? data.documentInspectionItems.find((documentRow) => documentRow.id === input.id)
    : null;
  const row: DocumentInspectionItem = {
    id: existing?.id ?? input.id ?? randomUUID(),
    sequence: Number(input.sequence) || nextSequence(data.documentInspectionItems),
    listItem: input.listItem ?? existing?.listItem ?? "",
    category: input.category ?? existing?.category ?? "",
    responsibleDepartment: input.responsibleDepartment ?? existing?.responsibleDepartment ?? "",
    responsiblePosition: input.responsiblePosition ?? existing?.responsiblePosition ?? "",
    existsText: input.existsText ?? existing?.existsText ?? "",
    dueOrLatestDate: input.dueOrLatestDate ?? existing?.dueOrLatestDate ?? "",
    note: input.note ?? existing?.note ?? "",
    additionalNote: input.additionalNote ?? existing?.additionalNote ?? "",
    sourceSheetName: input.sourceSheetName ?? existing?.sourceSheetName ?? "Sheet1",
    sourceRow: input.sourceRow ?? existing?.sourceRow,
  };
  writeMasterWorkbook({
    ...data,
    documentInspectionItems: input.id
      ? data.documentInspectionItems.map((x) => (x.id === input.id ? { ...x, ...row } : x))
      : [...data.documentInspectionItems, row],
  });
}

export function deleteDocumentInspectionItem(id: string) {
  const data = readMasterWorkbook();
  writeMasterWorkbook({
    ...data,
    documentInspectionItems: data.documentInspectionItems.filter((row) => row.id !== id),
  });
}

export function upsertStateInspectionRow(input: Partial<StateInspectionProgressRow> & { id?: string }) {
  const data = readMasterWorkbook();
  const existing = input.id
    ? data.stateInspectionRows.find((stateRow) => stateRow.id === input.id)
    : null;
  const row: StateInspectionProgressRow = {
    id: existing?.id ?? input.id ?? randomUUID(),
    sequence: Number(input.sequence) || nextSequence(data.stateInspectionRows),
    authority: input.authority ?? existing?.authority ?? "",
    checklistNumber: input.checklistNumber ?? existing?.checklistNumber ?? "",
    checklistName: input.checklistName ?? existing?.checklistName ?? "",
    inspectionDate: input.inspectionDate ?? existing?.inspectionDate ?? "",
    requiredScoreFormulaOrValue: input.requiredScoreFormulaOrValue ?? existing?.requiredScoreFormulaOrValue ?? "",
    failedScore: input.failedScore == null ? existing?.failedScore ?? null : Number(input.failedScore),
    riskPercentFormulaOrValue: input.riskPercentFormulaOrValue ?? existing?.riskPercentFormulaOrValue ?? "",
    implementationFormulaOrValue: input.implementationFormulaOrValue ?? existing?.implementationFormulaOrValue ?? "",
    violationCountFormulaOrValue: input.violationCountFormulaOrValue ?? existing?.violationCountFormulaOrValue ?? "",
    executionStatus: input.executionStatus ?? existing?.executionStatus ?? "",
    responsibleEmployee: input.responsibleEmployee ?? existing?.responsibleEmployee ?? "",
    progressPercent: input.progressPercent == null ? existing?.progressPercent ?? null : Number(input.progressPercent),
    dueDate: input.dueDate ?? existing?.dueDate ?? "",
    sourceSheetName: "ХШТөрийн",
    sourceRow: input.sourceRow ?? existing?.sourceRow,
  };
  writeMasterWorkbook({
    ...data,
    stateInspectionRows: input.id
      ? data.stateInspectionRows.map((x) => (x.id === input.id ? { ...x, ...row } : x))
      : [...data.stateInspectionRows, row],
  });
}

export function deleteStateInspectionRow(id: string) {
  const data = readMasterWorkbook();
  writeMasterWorkbook({
    ...data,
    stateInspectionRows: data.stateInspectionRows.filter((row) => row.id !== id),
  });
}

export function reloadTemplatesFromImport(): InspectionCenterData {
  const current = readStore();
  const imported = loadImportedTemplates();
  const next: InspectionCenterData = {
    ...current,
    templates: imported.templates,
    sections: imported.sections,
    questions: imported.questions,
  };
  writeStore(next);
  return next;
}

export function upsertTemplate(input: Partial<InspectionTemplate> & { id?: string }) {
  const data = readStore();
  const now = new Date().toISOString();
  const existing = input.id
    ? data.templates.find((template) => template.id === input.id)
    : null;
  const template: InspectionTemplate = {
    id: existing?.id ?? input.id ?? randomUUID(),
    code: input.code ?? existing?.code ?? "",
    title: input.title ?? existing?.title ?? "",
    category: input.category ?? existing?.category ?? "",
    sourceSheetName: input.sourceSheetName ?? existing?.sourceSheetName ?? "manual",
    regulatorySource: input.regulatorySource ?? existing?.regulatorySource ?? "",
    active: input.active ?? existing?.active ?? true,
    version: input.version ?? existing?.version ?? 1,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  writeStore({
    ...data,
    templates: existing
      ? data.templates.map((row) => (row.id === template.id ? template : row))
      : [template, ...data.templates],
  });
  return template;
}

export function deleteTemplate(templateId: string) {
  const data = readStore();
  const questions = data.questions.filter((q) => q.templateId === templateId);
  const questionIds = new Set(questions.map((q) => q.id));
  writeStore({
    ...data,
    templates: data.templates.filter((t) => t.id !== templateId),
    sections: data.sections.filter((s) => s.templateId !== templateId),
    questions: data.questions.filter((q) => q.templateId !== templateId),
    runs: data.runs.map((r) =>
      r.templateId === templateId ? { ...r, templateId: null } : r,
    ),
    answers: data.answers.filter((a) => !questionIds.has(a.templateQuestionId)),
  });
}

export function upsertTemplateQuestion(
  input: Partial<InspectionTemplateQuestion> & { templateId: string; id?: string },
) {
  const data = readStore();
  const existing = input.id
    ? data.questions.find((question) => question.id === input.id)
    : null;
  const orderIndex =
    input.orderIndex ??
    existing?.orderIndex ??
    data.questions
      .filter((q) => q.templateId === input.templateId)
      .reduce((max, q) => Math.max(max, q.orderIndex), 0) +
      1;
  const question: InspectionTemplateQuestion = {
    id: existing?.id ?? input.id ?? randomUUID(),
    templateId: input.templateId,
    sectionId: input.sectionId ?? existing?.sectionId ?? null,
    questionNo: input.questionNo ?? existing?.questionNo ?? String(orderIndex),
    legalReference: input.legalReference ?? existing?.legalReference ?? "",
    legalMergeGroupId:
      input.legalMergeGroupId !== undefined
        ? input.legalMergeGroupId
        : (existing?.legalMergeGroupId ?? null),
    questionText: input.questionText ?? existing?.questionText ?? "",
    approvedScore: Number(input.approvedScore ?? existing?.approvedScore ?? 0),
    orderIndex,
    active: input.active ?? existing?.active ?? true,
    sourceSheetName: input.sourceSheetName ?? existing?.sourceSheetName ?? "manual",
    sourceCellRef: input.sourceCellRef ?? existing?.sourceCellRef,
    rawText: input.rawText ?? existing?.rawText,
  };
  writeStore({
    ...data,
    questions: existing
      ? data.questions.map((row) => (row.id === question.id ? question : row))
      : [...data.questions, question],
  });
}

export function upsertTemplateSection(
  input: Partial<InspectionTemplateSection> & { templateId: string; id?: string },
) {
  const data = readStore();
  const existing = input.id
    ? data.sections.find((s) => s.id === input.id)
    : null;
  const orderIndex =
    input.orderIndex ??
    existing?.orderIndex ??
    data.sections
      .filter((s) => s.templateId === input.templateId)
      .reduce((max, s) => Math.max(max, s.orderIndex), 0) +
      1;
  const section: InspectionTemplateSection = {
    id: existing?.id ?? input.id ?? randomUUID(),
    templateId: input.templateId,
    parentId: input.parentId ?? existing?.parentId ?? null,
    sectionNo: input.sectionNo ?? existing?.sectionNo ?? String(orderIndex),
    title: input.title ?? existing?.title ?? "",
    orderIndex,
  };
  writeStore({
    ...data,
    sections: existing
      ? data.sections.map((row) => (row.id === section.id ? section : row))
      : [...data.sections, section],
  });
  return section;
}

export function deleteTemplateSection(sectionId: string) {
  const data = readStore();
  writeStore({
    ...data,
    sections: data.sections.filter((s) => s.id !== sectionId),
    questions: data.questions.map((q) =>
      q.sectionId === sectionId ? { ...q, sectionId: null } : q,
    ),
  });
}

/**
 * Replace a template's section + question sheet in one write (Excel-like editor save).
 * Questions and sections for this template are replaced; other templates untouched.
 */
export function replaceTemplateSheet(
  templateId: string,
  input: {
    sections: Array<{
      id: string;
      title: string;
      sectionNo?: string;
      orderIndex: number;
    }>;
    questions: Array<{
      id: string;
      sectionId: string | null;
      questionNo: string;
      legalReference: string;
      legalMergeGroupId?: string | null;
      questionText: string;
      approvedScore: number;
      orderIndex: number;
      active?: boolean;
    }>;
  },
) {
  const data = readStore();
  const template = data.templates.find((t) => t.id === templateId);
  if (!template) return false;

  const now = new Date().toISOString();
  const keepQuestionIds = new Set(input.questions.map((q) => q.id));
  const removedQuestionIds = data.questions
    .filter((q) => q.templateId === templateId && !keepQuestionIds.has(q.id))
    .map((q) => q.id);

  const nextSections: InspectionTemplateSection[] = input.sections.map((s) => ({
    id: s.id,
    templateId,
    parentId: null,
    sectionNo: s.sectionNo ?? String(s.orderIndex),
    title: s.title,
    orderIndex: s.orderIndex,
  }));

  const nextQuestions: InspectionTemplateQuestion[] = input.questions.map(
    (q) => {
      const existing = data.questions.find((row) => row.id === q.id);
      return {
        id: q.id,
        templateId,
        sectionId: q.sectionId,
        questionNo: q.questionNo,
        legalReference: q.legalReference,
        legalMergeGroupId: q.legalMergeGroupId ?? null,
        questionText: q.questionText,
        approvedScore: Number(q.approvedScore) || 0,
        orderIndex: q.orderIndex,
        active: q.active ?? true,
        sourceSheetName: existing?.sourceSheetName ?? "manual",
        sourceCellRef: existing?.sourceCellRef,
        rawText: existing?.rawText,
      };
    },
  );

  writeStore({
    ...data,
    templates: data.templates.map((t) =>
      t.id === templateId ? { ...t, updatedAt: now, version: t.version + 1 } : t,
    ),
    sections: [
      ...data.sections.filter((s) => s.templateId !== templateId),
      ...nextSections,
    ],
    questions: [
      ...data.questions.filter((q) => q.templateId !== templateId),
      ...nextQuestions,
    ],
    answers: data.answers.filter(
      (a) => !removedQuestionIds.includes(a.templateQuestionId),
    ),
  });
  return true;
}

export function deleteTemplateQuestion(questionId: string) {
  const data = readStore();
  writeStore({
    ...data,
    questions: data.questions.filter((q) => q.id !== questionId),
    answers: data.answers.filter((a) => a.templateQuestionId !== questionId),
  });
}

export function readAnnualPlans(): AnnualPlanRow[] {
  const memory = storeMemory();
  if (memory.annualPlans) return memory.annualPlans;

  const fromDisk = readJsonFile<AnnualPlanRow[]>(
    ANNUAL_PLAN_FILE,
    ANNUAL_PLAN_SEED_FILE,
  );
  if (!fromDisk) {
    const now = new Date().toISOString();
    const seeded: AnnualPlanRow[] = [
      {
        id: randomUUID(),
        inspectionType: "STATE_INSPECTION",
        checklistName: "Төрийн ХШ хуудсаар хяналт, шалгалт",
        metric: "planned",
        year: 2026,
        months: { "1": 3 },
        detailDates: { "1": ["2026-01-03"] },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        inspectionType: "STATE_INSPECTION",
        checklistName: "Төрийн ХШ хуудсаар хяналт, шалгалт",
        metric: "unplanned",
        year: 2026,
        months: { "1": 10 },
        detailDates: { "1": ["2026-01-10"] },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        inspectionType: "STATE_INSPECTION",
        checklistName: "Төрийн ХШ хуудсаар хяналт, шалгалт",
        metric: "completed",
        year: 2026,
        months: { "2": 5 },
        detailDates: { "2": ["2026-02-05"] },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        inspectionType: "NIGHT_INSPECTION",
        checklistName: "Шөнийн хяналт шалгалт",
        metric: "regular",
        year: 2026,
        months: { "1": 15, "2": 5 },
        detailDates: {},
        createdAt: now,
        updatedAt: now,
      },
      {
        id: randomUUID(),
        inspectionType: "JOINT_INSPECTION",
        checklistName: "Хамтарсан хяналт шалгалт",
        metric: "regular",
        year: 2026,
        months: { "1": 20 },
        detailDates: {},
        createdAt: now,
        updatedAt: now,
      },
    ];
    writeAnnualPlans(seeded);
    return seeded;
  }

  memory.annualPlans = fromDisk;
  return fromDisk;
}

export function writeAnnualPlans(rows: AnnualPlanRow[]) {
  const memory = storeMemory();
  memory.annualPlans = rows;
  writeJsonFile(ANNUAL_PLAN_FILE, rows);
  queueRemoteWrite(REMOTE_KEYS.annualPlans, rows, (updatedAt) => {
    memory.annualPlansUpdatedAt = updatedAt;
  });
}

export function readAnnualPlanTypeTargets(): AnnualPlanTypeTarget[] {
  const memory = storeMemory();
  if (memory.annualPlanTypes) return memory.annualPlanTypes;

  const raw =
    readJsonFile<AnnualPlanTypeTarget[]>(
      ANNUAL_PLAN_TYPE_FILE,
      ANNUAL_PLAN_TYPE_SEED_FILE,
    ) ?? [];
  const normalized = raw.map((row) => {
    const base = emptyAnnualPlanTypeCounts();
    const counts = { ...base };
    for (const type of Object.keys(base) as InspectionType[]) {
      counts[type] = normalizeAnnualPlanPeriodCounts(row.counts?.[type]);
    }
    const checklistMonths = normalizeChecklistMonths(row.checklistMonths);
    counts.CHECKLIST = {
      quarter: 0,
      month: 0,
      shift: countChecklistMonthSelections(checklistMonths),
    };
    return {
      ...row,
      counts,
      checklistMonths,
      notes: row.notes ?? {},
    };
  });
  memory.annualPlanTypes = normalized;
  return normalized;
}

export function writeAnnualPlanTypeTargets(rows: AnnualPlanTypeTarget[]) {
  const memory = storeMemory();
  memory.annualPlanTypes = rows;
  writeJsonFile(ANNUAL_PLAN_TYPE_FILE, rows);
  queueRemoteWrite(REMOTE_KEYS.annualPlanTypes, rows, (updatedAt) => {
    memory.annualPlanTypesUpdatedAt = updatedAt;
  });
}

export function upsertAnnualPlanTypeTarget(input: {
  year: number;
  counts: Partial<Record<InspectionType, AnnualPlanPeriodCounts>>;
  checklistMonths?: Record<string, boolean[]>;
  notes?: Partial<Record<InspectionType, string>>;
}): AnnualPlanTypeTarget {
  const rows = readAnnualPlanTypeTargets();
  const now = new Date().toISOString();
  const existing = rows.find((row) => row.year === input.year);
  const counts = emptyAnnualPlanTypeCounts();
  for (const type of Object.keys(counts) as InspectionType[]) {
    counts[type] = normalizeAnnualPlanPeriodCounts(
      input.counts?.[type] ?? existing?.counts?.[type],
    );
  }
  const checklistMonths = normalizeChecklistMonths(
    input.checklistMonths ?? existing?.checklistMonths,
  );
  counts.CHECKLIST = {
    quarter: 0,
    month: 0,
    shift: countChecklistMonthSelections(checklistMonths),
  };
  // Drop төрийн / төлөвлөгөөт бус ХШ from persisted yearly-by-type plan.
  counts.STATE_INSPECTION = { quarter: 0, month: 0, shift: 0 };
  counts.UNPLANNED_INSPECTION = { quarter: 0, month: 0, shift: 0 };

  const next: AnnualPlanTypeTarget = {
    year: input.year,
    counts,
    checklistMonths,
    notes: {
      ...Object.fromEntries(
        ANNUAL_PLAN_TYPE_ORDER.map((type) => [
          type,
          String(input.notes?.[type] ?? existing?.notes?.[type] ?? "").trim(),
        ]),
      ),
    },
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  writeAnnualPlanTypeTargets(
    existing
      ? rows.map((row) => (row.year === next.year ? next : row))
      : [...rows, next].sort((a, b) => b.year - a.year),
  );
  return next;
}

export function upsertAnnualPlanRow(input: {
  id?: string;
  inspectionType: InspectionRun["inspectionType"];
  templateId?: string | null;
  checklistName: string;
  metric: AnnualPlanRow["metric"];
  year: number;
  month: number;
  count: number;
  detailDate?: string;
}): { row: AnnualPlanRow; created: boolean } {
  const rows = readAnnualPlans();
  const now = new Date().toISOString();
  const existing = input.id ? rows.find((row) => row.id === input.id) : null;
  const monthKey = String(input.month);
  const next: AnnualPlanRow = {
    id: existing?.id ?? randomUUID(),
    inspectionType: input.inspectionType,
    templateId: input.templateId ?? existing?.templateId ?? null,
    checklistName: input.checklistName,
    metric: input.metric,
    year: input.year,
    months: {
      ...(existing?.months ?? {}),
      [monthKey]: Number(input.count) || 0,
    },
    detailDates: {
      ...(existing?.detailDates ?? {}),
      [monthKey]: input.detailDate
        ? [input.detailDate]
        : existing?.detailDates?.[monthKey] ?? [],
    },
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  writeAnnualPlans(
    existing
      ? rows.map((row) => (row.id === next.id ? next : row))
      : [...rows, next],
  );
  return { row: next, created: !existing };
}

/** Create a draft Inspection Run linked to a newly added annual plan row. */
export function createDraftRunForAnnualPlan(row: AnnualPlanRow): InspectionRun {
  const { run, data } = buildDraftRunForAnnualPlan(row, readStore());
  writeStore(data);
  return run;
}

/** Ensure every annual-plan row has a linked Inspection Run (`planId`). */
export function ensureDraftRunsForAnnualPlans(): InspectionRun[] {
  const plans = readAnnualPlans();
  let data = readStore();
  const linkedPlanIds = new Set(
    data.runs
      .map((run) => run.planId)
      .filter((planId): planId is string => Boolean(planId)),
  );
  const created: InspectionRun[] = [];

  for (const plan of plans) {
    if (linkedPlanIds.has(plan.id)) continue;
    const built = buildDraftRunForAnnualPlan(plan, data);
    data = built.data;
    created.push(built.run);
    linkedPlanIds.add(plan.id);
  }

  // One writeStore for the whole batch — avoids N multi-MB remote upserts.
  if (created.length > 0) {
    writeStore(data);
  }
  return created;
}

function buildDraftRunForAnnualPlan(
  row: AnnualPlanRow,
  data: InspectionCenterData,
): { run: InspectionRun; data: InspectionCenterData } {
  const monthKeys = Object.keys(row.months).sort(
    (a, b) => Number(a) - Number(b),
  );
  const firstMonth = monthKeys[0];
  const plannedDate =
    (firstMonth && row.detailDates?.[firstMonth]?.[0]) ||
    (firstMonth
      ? `${row.year}-${String(Number(firstMonth)).padStart(2, "0")}-01`
      : undefined);

  return appendRunFromTemplate(data, {
    templateId: row.templateId ?? undefined,
    inspectionType: row.inspectionType,
    planMetric: row.metric === "regular" ? "as_needed" : row.metric,
    status: "draft",
    title: row.checklistName,
    inspectionDate: plannedDate,
    dueDate: plannedDate ?? null,
    planId: row.id,
  });
}

const BY_TYPE_EXCLUDED_CODES = new Set(["JOINT", "NIGHT"]);
const BY_TYPE_EXCLUDED_LABELS = new Set([
  INSPECTION_TYPE_LABELS.NIGHT_INSPECTION,
  INSPECTION_TYPE_LABELS.JOINT_INSPECTION,
  INSPECTION_TYPE_LABELS.DOCUMENT_INSPECTION,
  INSPECTION_TYPE_LABELS.UNPLANNED_INSPECTION,
]);

function isSyncableChecklistTemplate(template: InspectionTemplate) {
  if (!template.active) return false;
  if (BY_TYPE_EXCLUDED_CODES.has(template.code)) return false;
  if (BY_TYPE_EXCLUDED_LABELS.has(template.category)) return false;
  if (BY_TYPE_EXCLUDED_LABELS.has(template.title)) return false;
  return true;
}

const AGGREGATE_PLAN_TYPES: InspectionType[] = [
  "NIGHT_INSPECTION",
  "JOINT_INSPECTION",
  "DOCUMENT_INSPECTION",
];

/**
 * Sync "ХШ төрлөөр" checklist month matrix (+ night/joint/doc totals)
 * into AnnualPlanRow list used by annual summary + runs execution.
 * Planned checklist rows never include night / joint / document templates.
 */
export function syncByTypePlanToAnnualPlans(input: {
  year: number;
  checklistMonths: Record<string, boolean[]>;
  counts: Partial<Record<InspectionType, AnnualPlanPeriodCounts>>;
}): { created: number; updated: number; removed: number } {
  const data = readStore();
  const templatesById = new Map(
    data.templates.map((template) => [template.id, template]),
  );
  const checklistMonths = normalizeChecklistMonths(input.checklistMonths);
  let rows = readAnnualPlans();
  let created = 0;
  let updated = 0;
  let removed = 0;
  const now = new Date().toISOString();
  const keepIds = new Set<string>();

  // --- CHECKLIST templates (month matrix) ---
  for (const [templateId, monthsSelected] of Object.entries(checklistMonths)) {
    const template = templatesById.get(templateId);
    if (!template || !isSyncableChecklistTemplate(template)) continue;

    const months: Record<string, number> = {};
    const detailDates: Record<string, string[]> = {};
    for (let i = 0; i < 12; i++) {
      if (!monthsSelected[i]) continue;
      const key = String(i + 1);
      months[key] = 1;
      detailDates[key] = [
        `${input.year}-${String(i + 1).padStart(2, "0")}-01`,
      ];
    }

    const existing = rows.find(
      (row) =>
        row.year === input.year &&
        row.metric === "planned" &&
        row.inspectionType === "CHECKLIST" &&
        row.templateId === templateId,
    );

    if (Object.keys(months).length === 0) {
      if (existing) {
        rows = rows.filter((row) => row.id !== existing.id);
        removed += 1;
      }
      continue;
    }

    // Preserve any existing detail dates for selected months
    if (existing?.detailDates) {
      for (const key of Object.keys(months)) {
        const prev = existing.detailDates[key];
        if (prev?.length) detailDates[key] = prev;
      }
    }

    const next: AnnualPlanRow = {
      id: existing?.id ?? randomUUID(),
      inspectionType: "CHECKLIST",
      templateId,
      checklistName: `${template.code} - ${template.title}`,
      metric: "planned",
      year: input.year,
      months,
      detailDates,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    keepIds.add(next.id);
    if (existing) {
      rows = rows.map((row) => (row.id === next.id ? next : row));
      updated += 1;
    } else {
      rows = [...rows, next];
      created += 1;
    }
  }

  // Remove planned CHECKLIST rows for syncable templates no longer selected
  for (const row of rows.slice()) {
    if (
      row.year === input.year &&
      row.metric === "planned" &&
      row.inspectionType === "CHECKLIST" &&
      row.templateId &&
      !keepIds.has(row.id)
    ) {
      const template = templatesById.get(row.templateId);
      if (template && isSyncableChecklistTemplate(template)) {
        rows = rows.filter((item) => item.id !== row.id);
        removed += 1;
      }
    }
  }

  // --- Aggregate night / joint / document totals (not on monthly chart) ---
  for (const type of AGGREGATE_PLAN_TYPES) {
    const total = Math.max(
      0,
      Number(input.counts[type]?.shift) || 0,
    );
    const existing = rows.find(
      (row) =>
        row.year === input.year &&
        row.metric === "planned" &&
        row.inspectionType === type &&
        !row.templateId,
    );
    if (total <= 0) {
      if (existing) {
        rows = rows.filter((row) => row.id !== existing.id);
        removed += 1;
      }
      continue;
    }
    const next: AnnualPlanRow = {
      id: existing?.id ?? randomUUID(),
      inspectionType: type,
      templateId: null,
      checklistName: INSPECTION_TYPE_LABELS[type],
      metric: "planned",
      year: input.year,
      months: { "1": total },
      detailDates: {
        "1": existing?.detailDates?.["1"]?.length
          ? existing.detailDates["1"]
          : [`${input.year}-01-01`],
      },
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    if (existing) {
      rows = rows.map((row) => (row.id === next.id ? next : row));
      updated += 1;
    } else {
      rows = [...rows, next];
      created += 1;
    }
  }

  writeAnnualPlans(rows);

  // Drop runs linked to removed plans. Do NOT auto-create draft runs here —
  // "Төрлөөр" only plans counts; execution runs start from "Хуудсаар" → Гүйцэтгэл
  // or "Шинэ шалгалт", then confirm via Хадгалах.
  const planIds = new Set(rows.map((row) => row.id));
  const orphanRuns = data.runs.filter(
    (run) => run.planId && !planIds.has(run.planId),
  );
  if (orphanRuns.length > 0) {
    let nextData = data;
    for (const run of orphanRuns) {
      nextData = purgeRunFromData(nextData, run.id);
    }
    writeStore(nextData);
  }

  return { created, updated, removed };
}

function purgeRunFromData(
  data: InspectionCenterData,
  runId: string,
): InspectionCenterData {
  const findingIds = new Set(
    data.findings
      .filter((finding) => finding.runId === runId)
      .map((finding) => finding.id),
  );
  const answerIds = new Set(
    data.answers
      .filter((answer) => answer.runId === runId)
      .map((answer) => answer.id),
  );
  const actionIds = new Set(
    data.actions
      .filter((action) => findingIds.has(action.findingId))
      .map((action) => action.id),
  );

  return {
    ...data,
    runs: data.runs
      .filter((run) => run.id !== runId)
      .map((run) =>
        run.followUpOfRunId === runId
          ? { ...run, followUpOfRunId: null, updatedAt: new Date().toISOString() }
          : run,
      ),
    answers: data.answers.filter((answer) => answer.runId !== runId),
    findings: data.findings.filter((finding) => finding.runId !== runId),
    actions: data.actions.filter((action) => !findingIds.has(action.findingId)),
    evidence: data.evidence.filter(
      (item) =>
        item.runId !== runId &&
        !(item.findingId && findingIds.has(item.findingId)) &&
        !(item.answerId && answerIds.has(item.answerId)) &&
        !(item.actionId && actionIds.has(item.actionId)),
    ),
    scoreSnapshots: data.scoreSnapshots.filter(
      (snapshot) => snapshot.runId !== runId,
    ),
  };
}

/** Delete a run and its linked annual-plan row (if any). */
export function deleteInspectionRun(runId: string) {
  const data = readStore();
  const run = data.runs.find((row) => row.id === runId);
  if (!run) return;

  writeStore(purgeRunFromData(data, runId));

  if (run.planId) {
    writeAnnualPlans(
      readAnnualPlans().filter((row) => row.id !== run.planId),
    );
  }
}

export function deleteAnnualPlanRow(id: string) {
  const data = readStore();
  const linkedRuns = data.runs.filter((run) => run.planId === id);
  if (linkedRuns.length > 0) {
    let next = data;
    for (const run of linkedRuns) {
      next = purgeRunFromData(next, run.id);
    }
    writeStore(next);
  }
  writeAnnualPlans(readAnnualPlans().filter((row) => row.id !== id));
}

export function getTemplateQuestions(
  data: InspectionCenterData,
  templateId: string,
): InspectionTemplateQuestion[] {
  return data.questions
    .filter((q) => q.templateId === templateId && q.active)
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

function getDefaultUnplannedTemplate(
  data: InspectionCenterData,
): InspectionTemplate | null {
  const label = INSPECTION_TYPE_LABELS.UNPLANNED_INSPECTION;
  return (
    data.templates.find(
      (template) => template.active && template.category === label,
    ) ??
    data.templates.find(
      (template) => template.active && template.title === label,
    ) ??
    null
  );
}

export function getRunScore(
  data: InspectionCenterData,
  runId: string,
): InspectionScoreSnapshot | null {
  const answers = data.answers.filter((answer) => answer.runId === runId);
  if (answers.length === 0) return null;
  const latest =
    data.scoreSnapshots
      .filter((s) => s.runId === runId)
      .sort((a, b) => b.calculatedAt.localeCompare(a.calculatedAt))[0] ?? null;
  return {
    id: latest?.id ?? `derived-${runId}`,
    runId,
    ...calculateRunScore(answers, data.riskThresholds),
    calculatedAt: latest?.calculatedAt ?? new Date().toISOString(),
  };
}

export function upsertRunScore(
  data: InspectionCenterData,
  runId: string,
): InspectionCenterData {
  const answers = data.answers.filter((a) => a.runId === runId);
  const score = calculateRunScore(answers, data.riskThresholds);
  const snapshot: InspectionScoreSnapshot = {
    id: randomUUID(),
    runId,
    ...score,
    calculatedAt: new Date().toISOString(),
  };
  return {
    ...data,
    scoreSnapshots: [
      ...data.scoreSnapshots.filter((s) => s.runId !== runId),
      snapshot,
    ],
  };
}

function buildSpecialFormQuestions(
  run: InspectionRun,
  master: MasterWorkbookData,
): InspectionTemplateQuestion[] {
  const templateId = `run-form-${run.id}`;

  if (run.inspectionType === "JOINT_INSPECTION") {
    return master.jointInspectionItems.map((item, index) => ({
      id: randomUUID(),
      templateId,
      sectionId: null,
      questionNo: String(item.sequence || index + 1),
      legalReference: item.category,
      questionText: item.item,
      approvedScore: Number(item.maxScore) || 1,
      orderIndex: index + 1,
      active: true,
      sourceSheetName: item.sourceSheetName,
      sourceCellRef: item.sourceRow ? `row:${item.sourceRow}` : undefined,
      rawText: item.category,
    }));
  }

  if (run.inspectionType === "NIGHT_INSPECTION") {
    return master.nightInspectionItems.map((item, index) => ({
      id: randomUUID(),
      templateId,
      sectionId: null,
      questionNo: String(item.sequence || index + 1),
      legalReference: [item.area, item.sectionNo].filter(Boolean).join(" / "),
      questionText: [item.sectionTitle, item.item, item.note]
        .filter(Boolean)
        .join(" - "),
      approvedScore: 1,
      orderIndex: index + 1,
      active: true,
      sourceSheetName: item.sourceSheetName,
      sourceCellRef: item.sourceRow ? `row:${item.sourceRow}` : undefined,
      rawText: item.area,
    }));
  }

  if (run.inspectionType === "DOCUMENT_INSPECTION") {
    return master.documentInspectionItems.map((item, index) => ({
      id: randomUUID(),
      templateId,
      sectionId: null,
      questionNo: String(item.sequence || index + 1),
      legalReference: [
        item.category,
        item.responsibleDepartment,
        item.responsiblePosition,
      ]
        .filter(Boolean)
        .join(" / "),
      questionText: [
        item.listItem,
        item.dueOrLatestDate ? `Хугацаа: ${item.dueOrLatestDate}` : "",
        item.note,
        item.additionalNote,
      ]
        .filter(Boolean)
        .join(" - "),
      approvedScore: 1,
      orderIndex: index + 1,
      active: true,
      sourceSheetName: item.sourceSheetName,
      sourceCellRef: item.sourceRow ? `row:${item.sourceRow}` : undefined,
      rawText: item.existsText,
    }));
  }

  return [];
}

function createAnswersForQuestions(
  runId: string,
  questions: InspectionTemplateQuestion[],
): InspectionAnswer[] {
  return questions.map((q) => ({
    id: randomUUID(),
    runId,
    templateQuestionId: q.id,
    isApplicable: true,
    approvedScore: q.approvedScore,
    receivedScore: 0,
    complianceStatus: deriveComplianceStatus(true, q.approvedScore, 0),
    comment: "",
    answeredBy: "",
    answeredAt: "",
  }));
}

export function ensureRunFormAnswers(runId: string): InspectionCenterData {
  const data = readStore();
  const run = data.runs.find((item) => item.id === runId);
  if (!run) return data;
  if (data.answers.some((answer) => answer.runId === run.id)) return data;
  if (run.templateId) return data;

  if (run.inspectionType === "UNPLANNED_INSPECTION") {
    const template = getDefaultUnplannedTemplate(data);
    if (template) {
      const questions = getTemplateQuestions(data, template.id);
      if (questions.length === 0) return data;

      let next: InspectionCenterData = {
        ...data,
        runs: data.runs.map((item) =>
          item.id === run.id ? { ...item, templateId: template.id } : item,
        ),
        answers: [...createAnswersForQuestions(run.id, questions), ...data.answers],
      };
      next = upsertRunScore(next, run.id);
      writeStore(next);
      return next;
    }
  }

  const questions = buildSpecialFormQuestions(run, readMasterWorkbook());
  if (questions.length === 0) return data;

  let next: InspectionCenterData = {
    ...data,
    questions: [...data.questions, ...questions],
    answers: [...createAnswersForQuestions(run.id, questions), ...data.answers],
  };
  next = upsertRunScore(next, run.id);
  writeStore(next);
  return next;
}

export function createRunFromTemplate(input: {
  templateId?: string;
  inspectionType?: InspectionRun["inspectionType"];
  planMetric?: AnnualPlanRow["metric"] | null;
  status?: InspectionRun["status"];
  title?: string;
  inspectedByOrg?: string;
  inspectionDate?: string;
  dueDate?: string | null;
  completedDate?: string | null;
  followUpOfRunId?: string | null;
  followUpNotes?: string;
  leadInspectorId?: string;
  planId?: string | null;
}): InspectionRun {
  const { run, data } = appendRunFromTemplate(readStore(), input);
  writeStore(data);
  return run;
}

/** Build a run + answers in memory without persisting (for batch creates). */
function appendRunFromTemplate(
  data: InspectionCenterData,
  input: {
    templateId?: string;
    inspectionType?: InspectionRun["inspectionType"];
    planMetric?: AnnualPlanRow["metric"] | null;
    status?: InspectionRun["status"];
    title?: string;
    inspectedByOrg?: string;
    inspectionDate?: string;
    dueDate?: string | null;
    completedDate?: string | null;
    followUpOfRunId?: string | null;
    followUpNotes?: string;
    leadInspectorId?: string;
    planId?: string | null;
  },
): { run: InspectionRun; data: InspectionCenterData } {
  const template = input.templateId
    ? data.templates.find((t) => t.id === input.templateId)
    : input.inspectionType === "UNPLANNED_INSPECTION"
      ? getDefaultUnplannedTemplate(data)
      : null;
  if (input.templateId && !template) throw new Error("Template not found");

  const now = new Date().toISOString();
  const run: InspectionRun = {
    id: randomUUID(),
    planId: input.planId ?? null,
    templateId: template?.id ?? null,
    inspectionType: input.inspectionType ?? "CHECKLIST",
    planMetric: input.planMetric ?? null,
    title:
      input.title ??
      (template
        ? `${template.code} ${template.title}`
        : input.inspectionType ?? "CHECKLIST"),
    inspectedByOrg: input.inspectedByOrg ?? "ДХШ",
    inspectionDate: input.inspectionDate ?? now.slice(0, 10),
    dueDate: input.dueDate ?? null,
    completedDate: input.completedDate ?? null,
    followUpOfRunId: input.followUpOfRunId ?? null,
    followUpNotes: input.followUpNotes ?? "",
    targetOrgUnitId: null,
    targetDepartmentId: null,
    targetLocationId: null,
    leadInspectorId: input.leadInspectorId ?? "inspector-1",
    status: input.status ?? "draft",
    notes: "",
    createdAt: now,
    updatedAt: now,
  };

  const questions = template
    ? getTemplateQuestions(data, template.id)
    : buildSpecialFormQuestions(run, readMasterWorkbook());
  const answers = createAnswersForQuestions(run.id, questions);

  let next: InspectionCenterData = {
    ...data,
    questions: template ? data.questions : [...data.questions, ...questions],
    runs: [run, ...data.runs],
    answers: [...answers, ...data.answers],
  };
  next = upsertRunScore(next, run.id);
  return { run, data: next };
}

export function updateAnswerScore(input: {
  answerId: string;
  isApplicable?: boolean;
  receivedScore?: number;
  comment?: string;
  answeredBy?: string;
}): InspectionAnswer {
  // Keep findings/actions in sync with run scores (single-cell edits).
  const synced = updateRunAnswersAndSyncFindings({
    runId: (() => {
      const data = readStore();
      const answer = data.answers.find((row) => row.id === input.answerId);
      if (!answer) throw new Error("Answer not found");
      return answer.runId;
    })(),
    answers: [
      {
        answerId: input.answerId,
        isApplicable: input.isApplicable,
        receivedScore: input.receivedScore,
        comment: input.comment,
      },
    ],
    answeredBy: input.answeredBy,
  });
  const answer = synced.answers.find((row) => row.id === input.answerId);
  if (!answer) throw new Error("Answer not found");
  return answer;
}

function isFollowUpRun(run: InspectionRun) {
  return run.planMetric === "completed";
}

function isUnitViolationScore(
  receivedScore: number | undefined,
  isApplicable: boolean | undefined,
) {
  return (isApplicable ?? true) && Math.max(0, receivedScore || 0) > 0;
}

function runHasSavedJointScopes(run: InspectionRun) {
  return (run.jointUnitScopes ?? []).some((scope) => scope.saved);
}

/**
 * Expand хамтарсан/шөнийн unit scopes into one finding (+ action) per
 * failing (answerId, unitKey). Replaces legacy one-finding-per-answer rows.
 */
function applyJointUnitFindingsSync(input: {
  data: InspectionCenterData;
  run: InspectionRun;
  now: string;
}): {
  findings: InspectionFinding[];
  actions: CorrectiveAction[];
  createdFindingIds: string[];
} {
  const { data, run, now } = input;
  const scopes = (run.jointUnitScopes ?? []).filter((scope) => scope.saved);
  const questionById = new Map(
    data.questions.map((question) => [question.id, question]),
  );
  const answerById = new Map(data.answers.map((answer) => [answer.id, answer]));

  type Desired = {
    key: string;
    answerId: string;
    unitKey: string;
    unitLabel: string;
    severity: Severity;
  };
  const desired = new Map<string, Desired>();

  for (const scope of scopes) {
    for (const [answerId, state] of Object.entries(scope.answers ?? {})) {
      if (!state) continue;
      if (!isUnitViolationScore(state.receivedScore, state.isApplicable)) {
        continue;
      }
      const answer = answerById.get(answerId);
      if (!answer || answer.runId !== run.id) continue;
      const key = `${answerId}::${scope.unitKey}`;
      desired.set(key, {
        key,
        answerId,
        unitKey: scope.unitKey,
        unitLabel: scope.label || scope.unitKey,
        severity:
          answer.complianceStatus === "fail" ||
          (answer.approvedScore > 0 &&
            (state.receivedScore || 0) >= answer.approvedScore)
            ? "high"
            : "medium",
      });
    }
  }

  const otherFindings = data.findings.filter(
    (finding) => finding.runId !== run.id,
  );
  const runFindings = data.findings.filter(
    (finding) => finding.runId === run.id,
  );
  const manualFindings = runFindings.filter((finding) => !finding.answerId);

  const keyed = new Map<string, InspectionFinding>();
  const legacyByAnswer = new Map<string, InspectionFinding[]>();
  for (const finding of runFindings) {
    if (!finding.answerId) continue;
    if (finding.jointUnitKey) {
      keyed.set(`${finding.answerId}::${finding.jointUnitKey}`, finding);
    } else {
      const list = legacyByAnswer.get(finding.answerId) ?? [];
      list.push(finding);
      legacyByAnswer.set(finding.answerId, list);
    }
  }

  const nextRunFindings: InspectionFinding[] = [...manualFindings];
  const createdFindingIds: string[] = [];
  const usedFindingIds = new Set(manualFindings.map((finding) => finding.id));

  for (const item of desired.values()) {
    const existing =
      keyed.get(item.key) ?? legacyByAnswer.get(item.answerId)?.shift();
    const answer = answerById.get(item.answerId)!;
    const question = questionById.get(answer.templateQuestionId);
    const titleBase = question
      ? `Зөрчил: ${question.questionNo}`
      : "Зөрчил";
    if (existing) {
      // Keep Арилсан/Баталгаажсан archive status — failing scores are historical.
      const updated: InspectionFinding = {
        ...existing,
        answerId: item.answerId,
        jointUnitKey: item.unitKey,
        title: `${titleBase} · ${item.unitLabel}`,
        description: question?.questionText ?? answer.comment,
        sourceText: question?.legalReference ?? existing.sourceText,
        targetOrgUnitId: item.unitLabel,
        targetDepartmentId: run.targetDepartmentId,
        severity: item.severity,
        status: existing.status,
        updatedAt: now,
      };
      nextRunFindings.push(updated);
      usedFindingIds.add(updated.id);
      continue;
    }

    const created: InspectionFinding = {
      id: randomUUID(),
      runId: run.id,
      answerId: item.answerId,
      findingType: "violation",
      severity: item.severity,
      title: `${titleBase} · ${item.unitLabel}`,
      description: question?.questionText ?? answer.comment,
      sourceText: question?.legalReference ?? "",
      targetOrgUnitId: item.unitLabel,
      targetDepartmentId: run.targetDepartmentId,
      targetJobPositionId: null,
      policyClauseId: null,
      jointUnitKey: item.unitKey,
      status: "open",
      createdAt: now,
      updatedAt: now,
    };
    nextRunFindings.push(created);
    createdFindingIds.push(created.id);
    usedFindingIds.add(created.id);
  }

  const findings = [...otherFindings, ...nextRunFindings];
  const findingIds = new Set(findings.map((finding) => finding.id));
  const keptActions = data.actions.filter((action) =>
    findingIds.has(action.findingId),
  );
  const existingActionFindingIds = new Set(
    keptActions.map((action) => action.findingId),
  );
  const createdActions: CorrectiveAction[] = nextRunFindings
    .filter(
      (finding) =>
        finding.status !== "resolved" &&
        finding.status !== "closed" &&
        !existingActionFindingIds.has(finding.id),
    )
    .map((finding) => ({
      id: randomUUID(),
      findingId: finding.id,
      actionText: "Зөрчлийг арилгах",
      responsibleEmployeeId: null,
      responsibleJobPositionId: null,
      responsibleOrgUnitId: finding.targetOrgUnitId,
      progressPercent: 0,
      startDate: now.slice(0, 10),
      dueDate: null,
      completedDate: null,
      status: "assigned",
      managerComment: "",
      createdAt: now,
      updatedAt: now,
    }));

  return {
    findings,
    actions: [...createdActions, ...keptActions],
    createdFindingIds,
  };
}

/** Repair joint/night findings so unit-scoped violations appear on related pages. */
export function ensureJointUnitFindingsLinked(): number {
  try {
    const data = readStore();
    const now = new Date().toISOString();
    let nextFindings = data.findings;
    let nextActions = data.actions;
    let created = 0;
    let changed = false;

    for (const run of data.runs) {
      if (
        run.inspectionType !== "JOINT_INSPECTION" &&
        run.inspectionType !== "NIGHT_INSPECTION"
      ) {
        continue;
      }
      if (!runHasSavedJointScopes(run)) continue;
      if (isFollowUpRun(run)) continue;

      const beforeFingerprint = nextFindings
        .filter((finding) => finding.runId === run.id && finding.answerId)
        .map(
          (finding) =>
            `${finding.id}|${finding.answerId}|${finding.jointUnitKey ?? ""}|${finding.status}`,
        )
        .sort()
        .join(";");

      const synced = applyJointUnitFindingsSync({
        data: { ...data, findings: nextFindings, actions: nextActions },
        run,
        now,
      });

      const afterFingerprint = synced.findings
        .filter((finding) => finding.runId === run.id && finding.answerId)
        .map(
          (finding) =>
            `${finding.id}|${finding.answerId}|${finding.jointUnitKey ?? ""}|${finding.status}`,
        )
        .sort()
        .join(";");

      const actionCountBefore = nextActions.filter((action) =>
        nextFindings.some(
          (finding) =>
            finding.runId === run.id && finding.id === action.findingId,
        ),
      ).length;
      const actionCountAfter = synced.actions.filter((action) =>
        synced.findings.some(
          (finding) =>
            finding.runId === run.id && finding.id === action.findingId,
        ),
      ).length;

      if (
        beforeFingerprint !== afterFingerprint ||
        actionCountBefore !== actionCountAfter
      ) {
        changed = true;
        created += synced.createdFindingIds.length;
        nextFindings = synced.findings;
        nextActions = synced.actions;
      }
    }

    if (!changed) return 0;
    writeStore({
      ...data,
      findings: nextFindings,
      actions: nextActions,
      evidence: data.evidence.filter(
        (item) =>
          !item.findingId || nextFindings.some((f) => f.id === item.findingId),
      ),
    });
    return created;
  } catch (error) {
    console.warn("[store] ensureJointUnitFindingsLinked failed", error);
    return 0;
  }
}

/**
 * Backfill findings+actions for checklist/state runs where answers already
 * fail but findings were never created (e.g. single-answer score updates).
 */
export function ensureAnswerFindingsLinked(): number {
  try {
    const data = readStore();
    const now = new Date().toISOString();
    const questionById = new Map(
      data.questions.map((question) => [question.id, question]),
    );
    const runsById = new Map(data.runs.map((run) => [run.id, run]));
    const actionFindingIds = new Set(
      data.actions.map((action) => action.findingId),
    );

    const findingByAnswerId = new Map<string, InspectionFinding>();
    for (const finding of data.findings) {
      if (!finding.answerId || finding.jointUnitKey) continue;
      if (!findingByAnswerId.has(finding.answerId)) {
        findingByAnswerId.set(finding.answerId, finding);
      }
    }

    const createdFindings: InspectionFinding[] = [];
    const createdActions: CorrectiveAction[] = [];
    const repairedFindings: InspectionFinding[] = [];
    const actionByFindingId = new Map(
      data.actions.map((action) => [action.findingId, action]),
    );

    for (const answer of data.answers) {
      if (!answer.isApplicable || answer.receivedScore <= 0) continue;
      const run = runsById.get(answer.runId);
      if (!run || isFollowUpRun(run)) continue;
      if (runHasSavedJointScopes(run)) continue;

      const existing = findingByAnswerId.get(answer.id);
      if (existing) {
        // Do not reopen resolved/closed findings when the answer still fails —
        // that score is historical; corrective-action archive owns closure.
        const linkedAction = actionByFindingId.get(existing.id);
        if (
          existing.status !== "resolved" &&
          existing.status !== "closed" &&
          linkedAction &&
          (linkedAction.status === "closed" ||
            linkedAction.status === "verified" ||
            linkedAction.progressPercent >= 100)
        ) {
          repairedFindings.push({
            ...existing,
            status: "resolved",
            updatedAt: now,
          });
        }
        if (!actionFindingIds.has(existing.id)) {
          createdActions.push({
            id: randomUUID(),
            findingId: existing.id,
            actionText: "Зөрчлийг арилгах",
            responsibleEmployeeId: null,
            responsibleJobPositionId: null,
            responsibleOrgUnitId: existing.targetOrgUnitId,
            progressPercent: 0,
            startDate: now.slice(0, 10),
            dueDate: null,
            completedDate: null,
            status: "assigned",
            managerComment: "",
            createdAt: now,
            updatedAt: now,
          });
          actionFindingIds.add(existing.id);
        }
        continue;
      }

      const question = questionById.get(answer.templateQuestionId);
      const finding: InspectionFinding = {
        id: randomUUID(),
        runId: answer.runId,
        answerId: answer.id,
        findingType: "violation",
        severity: answer.complianceStatus === "fail" ? "high" : "medium",
        title: question ? `Зөрчил: ${question.questionNo}` : "Зөрчил",
        description: question?.questionText ?? answer.comment,
        sourceText: question?.legalReference ?? "",
        targetOrgUnitId: run.targetOrgUnitId,
        targetDepartmentId: run.targetDepartmentId,
        targetJobPositionId: null,
        policyClauseId: null,
        status: "open",
        createdAt: now,
        updatedAt: now,
      };
      createdFindings.push(finding);
      findingByAnswerId.set(answer.id, finding);
      createdActions.push({
        id: randomUUID(),
        findingId: finding.id,
        actionText: "Зөрчлийг арилгах",
        responsibleEmployeeId: null,
        responsibleJobPositionId: null,
        responsibleOrgUnitId: finding.targetOrgUnitId,
        progressPercent: 0,
        startDate: now.slice(0, 10),
        dueDate: null,
        completedDate: null,
        status: "assigned",
        managerComment: "",
        createdAt: now,
        updatedAt: now,
      });
      actionFindingIds.add(finding.id);
    }

    if (
      createdFindings.length === 0 &&
      createdActions.length === 0 &&
      repairedFindings.length === 0
    ) {
      return 0;
    }

    const repairById = new Map(
      repairedFindings.map((finding) => [finding.id, finding]),
    );
    writeStore({
      ...data,
      findings: [
        ...createdFindings,
        ...data.findings.map((finding) => repairById.get(finding.id) ?? finding),
      ],
      actions: [...createdActions, ...data.actions],
    });
    return createdFindings.length;
  } catch (error) {
    console.warn("[store] ensureAnswerFindingsLinked failed", error);
    return 0;
  }
}

/** Expand run violations into findings/actions once per warm instance. */
export function ensureFindingsLinkedFromRuns(): number {
  return ensureJointUnitFindingsLinked() + ensureAnswerFindingsLinked();
}

function linkFindingsFromRunsIfNeeded() {
  const memory = storeMemory();
  if (!memory.store) return;
  if (memory.findingsLinkedAt) return;
  try {
    ensureFindingsLinkedFromRuns();
  } finally {
    // Mark even on no-op / partial failure so GET paths stay fast.
    memory.findingsLinkedAt = Date.now();
  }
}

function questionMatchesFollowUp(
  originalQuestion: InspectionTemplateQuestion | null,
  followUpQuestion: InspectionTemplateQuestion | null,
) {
  if (!originalQuestion || !followUpQuestion) return false;
  if (originalQuestion.id === followUpQuestion.id) return true;
  if (
    originalQuestion.sourceCellRef &&
    followUpQuestion.sourceCellRef &&
    originalQuestion.sourceCellRef === followUpQuestion.sourceCellRef
  ) {
    return true;
  }
  return (
    originalQuestion.questionNo === followUpQuestion.questionNo &&
    originalQuestion.questionText.trim().toLowerCase() ===
      followUpQuestion.questionText.trim().toLowerCase()
  );
}

function findingMatchesFollowUpAnswer(input: {
  finding: InspectionFinding;
  followUpRun: InspectionRun;
  followUpAnswer: InspectionAnswer;
  runsById: Map<string, InspectionRun>;
  answersById: Map<string, InspectionAnswer>;
  questionsById: Map<string, InspectionTemplateQuestion>;
}) {
  const originalRun = input.runsById.get(input.finding.runId);
  if (!originalRun || originalRun.id === input.followUpRun.id) return false;
  if (
    input.followUpRun.followUpOfRunId &&
    input.followUpRun.followUpOfRunId !== originalRun.id
  ) {
    return false;
  }
  if (isFollowUpRun(originalRun)) return false;
  if (originalRun.inspectionType !== input.followUpRun.inspectionType) return false;
  if (
    originalRun.templateId &&
    input.followUpRun.templateId &&
    originalRun.templateId !== input.followUpRun.templateId
  ) {
    return false;
  }
  if (
    originalRun.targetOrgUnitId &&
    input.followUpRun.targetOrgUnitId &&
    originalRun.targetOrgUnitId !== input.followUpRun.targetOrgUnitId
  ) {
    return false;
  }

  const originalAnswer = input.finding.answerId
    ? input.answersById.get(input.finding.answerId)
    : null;
  const originalQuestion = originalAnswer
    ? input.questionsById.get(originalAnswer.templateQuestionId) ?? null
    : null;
  const followUpQuestion =
    input.questionsById.get(input.followUpAnswer.templateQuestionId) ?? null;

  if (!questionMatchesFollowUp(originalQuestion, followUpQuestion)) {
    return false;
  }

  // Unit-scoped findings must only follow their own unit on joint/night follow-ups.
  if (input.finding.jointUnitKey) {
    const scopes = input.followUpRun.jointUnitScopes ?? [];
    return scopes.some(
      (scope) =>
        scope.saved && scope.unitKey === input.finding.jointUnitKey,
    );
  }

  return true;
}

function applyFollowUpRunResults(input: {
  findings: InspectionFinding[];
  run: InspectionRun;
  runAnswers: InspectionAnswer[];
  allRuns: InspectionRun[];
  allAnswers: InspectionAnswer[];
  allQuestions: InspectionTemplateQuestion[];
  now: string;
}) {
  if (!isFollowUpRun(input.run)) {
    return { findings: input.findings, touchedFindingIds: new Set<string>() };
  }

  const runsById = new Map(input.allRuns.map((run) => [run.id, run]));
  const answersById = new Map(input.allAnswers.map((answer) => [answer.id, answer]));
  const questionsById = new Map(input.allQuestions.map((question) => [question.id, question]));
  const nextStatusByFindingId = new Map<string, FindingStatus>();
  const followUpScopes = input.run.jointUnitScopes ?? [];

  for (const answer of input.runAnswers) {
    if (!answer.isApplicable) continue;
    for (const finding of input.findings) {
      if (
        !findingMatchesFollowUpAnswer({
          finding,
          followUpRun: input.run,
          followUpAnswer: answer,
          runsById,
          answersById,
          questionsById,
        })
      ) {
        continue;
      }

      let passed = answer.receivedScore <= 0;
      if (finding.jointUnitKey) {
        const scope = followUpScopes.find(
          (row) => row.saved && row.unitKey === finding.jointUnitKey,
        );
        const state = finding.answerId
          ? scope?.answers?.[finding.answerId]
          : undefined;
        if (!scope || !state) continue;
        passed = !isUnitViolationScore(state.receivedScore, state.isApplicable);
      }

      nextStatusByFindingId.set(
        finding.id,
        passed ? "resolved" : "in_progress",
      );
    }
  }

  return {
    findings: input.findings.map((finding) => {
      const status = nextStatusByFindingId.get(finding.id);
      return status ? { ...finding, status, updatedAt: input.now } : finding;
    }),
    touchedFindingIds: new Set(nextStatusByFindingId.keys()),
  };
}

export function updateRunAnswersAndSyncFindings(input: {
  runId: string;
  status?: Extract<RunStatus, "draft" | "in_progress" | "completed" | "cancelled">;
  inspectionDate?: string;
  dueDate?: string | null;
  completedDate?: string | null;
  performers?: InspectionPerformer[];
  answers: {
    answerId: string;
    isApplicable?: boolean;
    receivedScore?: number;
    comment?: string;
  }[];
  answeredBy?: string;
}): {
  answers: InspectionAnswer[];
  findings: InspectionFinding[];
  actions: CorrectiveAction[];
} {
  const data = readStore();
  const run = data.runs.find((row) => row.id === input.runId);
  if (!run) throw new Error("Run not found");

  const now = new Date().toISOString();
  const followUpRun = isFollowUpRun(run);
  const patches = new Map(input.answers.map((row) => [row.answerId, row]));
  const updatedAnswers = data.answers.map((answer) => {
    const patch = patches.get(answer.id);
    if (!patch) return answer;
    if (answer.runId !== input.runId) throw new Error("Answer/run mismatch");

    const isApplicable = patch.isApplicable ?? answer.isApplicable;
    const receivedScore = patch.receivedScore ?? answer.receivedScore;
    return {
      ...answer,
      isApplicable,
      receivedScore,
      comment: patch.comment ?? answer.comment,
      answeredBy: input.answeredBy ?? answer.answeredBy ?? "inspector-1",
      answeredAt: now,
      complianceStatus: deriveComplianceStatus(
        isApplicable,
        answer.approvedScore,
        receivedScore,
      ),
    };
  });

  const runAnswers = updatedAnswers.filter((answer) => answer.runId === input.runId);
  const useJointUnitFindings =
    !followUpRun && runHasSavedJointScopes(run);

  let nextFindings: InspectionFinding[];
  let nextActions: CorrectiveAction[];
  let followUpTouched = new Set<string>();

  if (useJointUnitFindings) {
    const synced = applyJointUnitFindingsSync({
      data: { ...data, answers: updatedAnswers },
      run,
      now,
    });
    nextFindings = synced.findings;
    nextActions = synced.actions;
  } else {
    const failingAnswerIds = new Set(
      runAnswers
        .filter((answer) => answer.isApplicable && answer.receivedScore > 0)
        .map((answer) => answer.id),
    );
    const staleAutoFindingIds = new Set(
      data.findings
        .filter(
          (finding) =>
            finding.runId === input.runId &&
            finding.answerId &&
            (followUpRun || !failingAnswerIds.has(finding.answerId)),
        )
        .map((finding) => finding.id),
    );

    const existingFindingByAnswerId = new Map(
      data.findings
        .filter(
          (finding) =>
            finding.runId === input.runId &&
            finding.answerId &&
            !staleAutoFindingIds.has(finding.id),
        )
        .map((finding) => [finding.answerId, finding]),
    );
    const questionById = new Map(
      data.questions.map((question) => [question.id, question]),
    );
    const createdFindings: InspectionFinding[] = [];

    for (const answer of runAnswers) {
      if (followUpRun) continue;
      if (!failingAnswerIds.has(answer.id)) continue;
      if (existingFindingByAnswerId.has(answer.id)) continue;

      const question = questionById.get(answer.templateQuestionId);
      createdFindings.push({
        id: randomUUID(),
        runId: answer.runId,
        answerId: answer.id,
        findingType: "violation",
        severity: answer.complianceStatus === "fail" ? "high" : "medium",
        title: question ? `Зөрчил: ${question.questionNo}` : "Зөрчил",
        description: question?.questionText ?? answer.comment,
        sourceText: question?.legalReference ?? "",
        targetOrgUnitId: run.targetOrgUnitId,
        targetDepartmentId: run.targetDepartmentId,
        targetJobPositionId: null,
        policyClauseId: null,
        status: "open",
        createdAt: now,
        updatedAt: now,
      });
    }

    const keptFindings = data.findings.filter(
      (finding) => !staleAutoFindingIds.has(finding.id),
    );
    const followUpResult = applyFollowUpRunResults({
      findings: keptFindings,
      run,
      runAnswers,
      allRuns: data.runs,
      allAnswers: updatedAnswers,
      allQuestions: data.questions,
      now,
    });
    followUpTouched = followUpResult.touchedFindingIds;
    nextFindings = [...createdFindings, ...followUpResult.findings];
    const findingIdsForActions = new Set(
      nextFindings.map((finding) => finding.id),
    );
    const existingActionFindingIds = new Set(
      data.actions
        .filter((action) => findingIdsForActions.has(action.findingId))
        .map((action) => action.findingId),
    );
    const createdActions = nextFindings
      .filter(
        (finding) =>
          finding.runId === input.runId &&
          finding.status !== "resolved" &&
          finding.status !== "closed" &&
          !existingActionFindingIds.has(finding.id),
      )
      .map((finding) => ({
        id: randomUUID(),
        findingId: finding.id,
        actionText: "Зөрчлийг арилгах",
        responsibleEmployeeId: null,
        responsibleJobPositionId: null,
        responsibleOrgUnitId: finding.targetOrgUnitId,
        progressPercent: 0,
        startDate: now.slice(0, 10),
        dueDate: null,
        completedDate: null,
        status: "assigned" as const,
        managerComment: "",
        createdAt: now,
        updatedAt: now,
      }));
    nextActions = [
      ...createdActions,
      ...data.actions.filter((action) =>
        findingIdsForActions.has(action.findingId),
      ),
    ];
  }

  const nextFindingById = new Map(
    nextFindings.map((finding) => [finding.id, finding]),
  );
  const findingIds = new Set(nextFindings.map((finding) => finding.id));

  const nextRuns = input.status
    || input.inspectionDate !== undefined
    || input.dueDate !== undefined
    || input.completedDate !== undefined
    || input.performers !== undefined
    ? data.runs.map((row) => {
        if (row.id !== input.runId) return row;
        return {
          ...row,
          status: input.status ? (input.status as RunStatus) : row.status,
          inspectionDate: input.inspectionDate ?? row.inspectionDate,
          dueDate: input.dueDate === undefined ? row.dueDate ?? null : input.dueDate || null,
          completedDate:
            input.completedDate === undefined
              ? row.completedDate ?? null
              : input.completedDate || null,
          performers:
            input.performers !== undefined ? input.performers : row.performers,
          updatedAt: now,
        };
      })
    : data.runs;

  let next: InspectionCenterData = {
    ...data,
    runs: nextRuns,
    answers: updatedAnswers,
    findings: nextFindings,
    actions: nextActions,
    evidence: data.evidence.filter(
      (item) => !item.findingId || findingIds.has(item.findingId),
    ),
  };
  next = {
    ...next,
    actions: next.actions.map((action) => {
      const finding = nextFindingById.get(action.findingId);
      if (!finding || !followUpTouched.has(finding.id)) return action;
      if (finding.status === "resolved" || finding.status === "closed") {
        return {
          ...action,
          progressPercent: 100,
          completedDate: action.completedDate ?? now.slice(0, 10),
          status: "closed",
          updatedAt: now,
        };
      }
      return {
        ...action,
        status: action.status === "closed" ? "in_progress" : action.status,
        progressPercent: Math.min(action.progressPercent, 90),
        completedDate: null,
        updatedAt: now,
      };
    }),
  };
  next = upsertRunScore(next, input.runId);
  writeStore(next);

  return {
    answers: runAnswers,
    findings: followUpRun
      ? next.findings.filter((finding) => followUpTouched.has(finding.id))
      : next.findings.filter((finding) => finding.runId === input.runId),
    actions: next.actions.filter((action) =>
      next.findings.some(
        (finding) =>
          (followUpRun
            ? followUpTouched.has(finding.id)
            : finding.runId === input.runId) && finding.id === action.findingId,
      ),
    ),
  };
}

function aggregateJointUnitAnswers(
  answerIds: string[],
  scopes: JointUnitScope[],
): Array<{
  answerId: string;
  isApplicable: boolean;
  receivedScore: number;
  comment: string;
}> {
  const saved = scopes.filter((scope) => scope.saved);
  return answerIds.map((answerId) => {
    let applicableCount = 0;
    let receivedTotal = 0;
    const comments: string[] = [];
    for (const scope of saved) {
      const row = scope.answers[answerId];
      if (!row) continue;
      if (row.isApplicable) {
        applicableCount += 1;
        receivedTotal += Math.max(0, row.receivedScore || 0);
      }
      const note = row.comment?.trim();
      if (note) comments.push(`${scope.label}: ${note}`);
    }
    return {
      answerId,
      isApplicable: applicableCount > 0 || saved.length === 0,
      receivedScore: receivedTotal,
      comment: comments.join(" · "),
    };
  });
}

export function saveJointUnitScopeAndSync(input: {
  runId: string;
  unitKey: string;
  unitLabel: string;
  answers: Array<{
    answerId: string;
    isApplicable?: boolean;
    receivedScore?: number;
    comment?: string;
    photoUrl?: string | null;
    photoName?: string | null;
  }>;
  status?: Extract<RunStatus, "draft" | "in_progress" | "completed" | "cancelled">;
  inspectionDate?: string;
  dueDate?: string | null;
  completedDate?: string | null;
  performers?: InspectionPerformer[];
  answeredBy?: string;
}) {
  const data = readStore();
  const run = data.runs.find((row) => row.id === input.runId);
  if (!run) throw new Error("Run not found");
  if (
    run.inspectionType !== "JOINT_INSPECTION" &&
    run.inspectionType !== "NIGHT_INSPECTION"
  ) {
    throw new Error("Зөвхөн хамтарсан/шөнийн ХШ дээр хэсэг хадгална");
  }

  const now = new Date().toISOString();
  const answerMap = Object.fromEntries(
    input.answers.map((row) => [
      row.answerId,
      {
        isApplicable: row.isApplicable ?? true,
        receivedScore: row.receivedScore ?? 0,
        comment: row.comment ?? "",
        photoUrl: row.photoUrl ?? null,
        photoName: row.photoName ?? null,
      } satisfies JointUnitAnswerState,
    ]),
  ) as Record<string, JointUnitAnswerState>;

  const existingScopes = run.jointUnitScopes ?? [];
  const nextScope: JointUnitScope = {
    unitKey: input.unitKey,
    label: input.unitLabel,
    saved: true,
    savedAt: now,
    answers: answerMap,
  };
  const jointUnitScopes = existingScopes.some(
    (scope) => scope.unitKey === input.unitKey,
  )
    ? existingScopes.map((scope) =>
        scope.unitKey === input.unitKey ? nextScope : scope,
      )
    : [...existingScopes, nextScope];

  writeStore({
    ...data,
    runs: data.runs.map((row) =>
      row.id === input.runId
        ? {
            ...row,
            jointUnitScopes,
            activeJointUnitKey: input.unitKey,
            updatedAt: now,
          }
        : row,
    ),
  });

  const answerIds = data.answers
    .filter((answer) => answer.runId === input.runId)
    .map((answer) => answer.id);

  const result = updateRunAnswersAndSyncFindings({
    runId: input.runId,
    answers: aggregateJointUnitAnswers(answerIds, jointUnitScopes),
    status: input.status,
    inspectionDate: input.inspectionDate,
    dueDate: input.dueDate,
    completedDate: input.completedDate,
    performers: input.performers,
    answeredBy: input.answeredBy,
  });

  const after = readStore();
  const photoCaptionPrefix = `${input.unitLabel}`;
  const keptEvidence = after.evidence.filter(
    (item) =>
      !(
        item.runId === input.runId &&
        item.caption.startsWith(`${photoCaptionPrefix} ·`)
      ),
  );
  const photoEvidence: InspectionEvidence[] = input.answers
    .filter((row) => Boolean(row.photoUrl))
    .map((row) => {
      const finding = after.findings.find(
        (item) =>
          item.runId === input.runId &&
          item.answerId === row.answerId &&
          (item.jointUnitKey == null ||
            item.jointUnitKey === input.unitKey),
      );
      const question = after.questions.find((q) => {
        const answer = after.answers.find((a) => a.id === row.answerId);
        return answer ? q.id === answer.templateQuestionId : false;
      });
      return {
        id: randomUUID(),
        runId: input.runId,
        answerId: row.answerId,
        findingId: finding?.id ?? null,
        actionId: null,
        fileUrl: row.photoUrl!,
        fileType: row.photoName?.match(/\.(png|jpe?g|webp|gif)$/i)?.[0]
          ? `image/${row.photoName!.split(".").pop()?.toLowerCase()}`
          : "image/jpeg",
        caption: `${photoCaptionPrefix} · ${question?.questionNo || row.answerId.slice(0, 6)}${
          row.photoName ? ` · ${row.photoName}` : ""
        }`,
        uploadedBy: input.answeredBy ?? "inspector-1",
        uploadedAt: now,
      } satisfies InspectionEvidence;
    });

  writeStore({
    ...after,
    evidence: [...photoEvidence, ...keptEvidence],
  });

  return result;
}

export function setActiveJointUnit(runId: string, unitKey: string | null) {
  const data = readStore();
  const run = data.runs.find((row) => row.id === runId);
  if (!run) throw new Error("Run not found");
  const now = new Date().toISOString();
  writeStore({
    ...data,
    runs: data.runs.map((row) =>
      row.id === runId
        ? { ...row, activeJointUnitKey: unitKey, updatedAt: now }
        : row,
    ),
  });
}

export function resetRunAnswers(runId: string): InspectionAnswer[] {
  const data = readStore();
  const now = new Date().toISOString();
  const runAnswerIds = new Set(
    data.answers
      .filter((answer) => answer.runId === runId)
      .map((answer) => answer.id),
  );
  const resetFindingIds = new Set(
    data.findings
      .filter(
        (finding) =>
          finding.runId === runId &&
          finding.answerId &&
          runAnswerIds.has(finding.answerId),
      )
      .map((finding) => finding.id),
  );
  const answers = data.answers.map((answer) =>
    answer.runId === runId
      ? {
          ...answer,
          isApplicable: true,
          receivedScore: 0,
          complianceStatus: deriveComplianceStatus(
            true,
            answer.approvedScore,
            0,
          ),
          comment: "",
          answeredBy: "inspector-1",
          answeredAt: now,
        }
      : answer,
  );
  const run = data.runs.find((row) => row.id === runId);
  let next: InspectionCenterData = {
    ...data,
    runs:
      run?.inspectionType === "JOINT_INSPECTION" ||
      run?.inspectionType === "NIGHT_INSPECTION"
        ? data.runs.map((row) =>
            row.id === runId
              ? {
                  ...row,
                  jointUnitScopes: [],
                  activeJointUnitKey: null,
                  updatedAt: now,
                }
              : row,
          )
        : data.runs,
    answers,
    findings: data.findings.filter((finding) => !resetFindingIds.has(finding.id)),
    actions: data.actions.filter((action) => !resetFindingIds.has(action.findingId)),
    evidence: data.evidence.filter(
      (item) => !item.findingId || !resetFindingIds.has(item.findingId),
    ),
  };
  next = upsertRunScore(next, runId);
  writeStore(next);
  return answers.filter((answer) => answer.runId === runId);
}

export function createFindingFromAnswer(answerId: string): InspectionFinding {
  const data = readStore();
  const answer = data.answers.find((a) => a.id === answerId);
  if (!answer) throw new Error("Answer not found");
  const existing = data.findings.find((f) => f.answerId === answerId);
  if (existing) {
    if (!data.actions.some((action) => action.findingId === existing.id)) {
      createActionForFinding(existing.id, "Зөрчлийг арилгах");
    }
    return existing;
  }
  const question = data.questions.find(
    (q) => q.id === answer.templateQuestionId,
  );
  const run = data.runs.find((r) => r.id === answer.runId);
  if (run && isFollowUpRun(run)) {
    throw new Error("Гүйцэтгэлийн ХШ нь шинэ зөрчил үүсгэхгүй, өмнөх зөрчлийн төлөвийг шинэчилнэ.");
  }
  const now = new Date().toISOString();

  const finding: InspectionFinding = {
    id: randomUUID(),
    runId: answer.runId,
    answerId: answer.id,
    findingType: "violation",
    severity: "medium",
    title: question
      ? `Зөрчил: ${question.questionNo}`
      : "Зөрчил",
    description: question?.questionText ?? answer.comment,
    sourceText: question?.legalReference ?? "",
    targetOrgUnitId: run?.targetOrgUnitId ?? null,
    targetDepartmentId: run?.targetDepartmentId ?? null,
    targetJobPositionId: null,
    policyClauseId: null,
    status: "open",
    createdAt: now,
    updatedAt: now,
  };

  const action: CorrectiveAction = {
    id: randomUUID(),
    findingId: finding.id,
    actionText: "Зөрчлийг арилгах",
    responsibleEmployeeId: null,
    responsibleJobPositionId: null,
    responsibleOrgUnitId: finding.targetOrgUnitId,
    progressPercent: 0,
    startDate: now.slice(0, 10),
    dueDate: null,
    completedDate: null,
    status: "assigned",
    managerComment: "",
    createdAt: now,
    updatedAt: now,
  };
  writeStore({
    ...data,
    findings: [finding, ...data.findings],
    actions: [action, ...data.actions],
  });
  return finding;
}

export function createActionForFinding(
  findingId: string,
  actionText: string,
): CorrectiveAction {
  const data = readStore();
  const finding = data.findings.find((f) => f.id === findingId);
  if (!finding) throw new Error("Finding not found");
  const existing = data.actions.find((a) => a.findingId === findingId);
  if (existing) {
    if (existing.actionText === actionText || !actionText) return existing;
    const updated = {
      ...existing,
      actionText,
      updatedAt: new Date().toISOString(),
    };
    writeStore({
      ...data,
      actions: data.actions.map((row) =>
        row.id === existing.id ? updated : row,
      ),
    });
    return updated;
  }
  const now = new Date().toISOString();
  const action: CorrectiveAction = {
    id: randomUUID(),
    findingId,
    actionText,
    responsibleEmployeeId: null,
    responsibleJobPositionId: null,
    responsibleOrgUnitId: finding.targetOrgUnitId,
    progressPercent: 0,
    startDate: now.slice(0, 10),
    dueDate: null,
    completedDate: null,
    status: "assigned",
    managerComment: "",
    createdAt: now,
    updatedAt: now,
  };
  writeStore({ ...data, actions: [action, ...data.actions] });
  return action;
}

/** Ensure every open finding has a corrective-action row (repairs older saves). */
export function ensureActionsForOpenFindings(): number {
  const data = readStore();
  const actionFindingIds = new Set(data.actions.map((action) => action.findingId));
  const now = new Date().toISOString();
  const missing = data.findings.filter(
    (finding) =>
      finding.status !== "resolved" &&
      finding.status !== "closed" &&
      !actionFindingIds.has(finding.id),
  );
  if (missing.length === 0) return 0;

  const createdActions: CorrectiveAction[] = missing.map((finding) => ({
    id: randomUUID(),
    findingId: finding.id,
    actionText: "Зөрчлийг арилгах",
    responsibleEmployeeId: null,
    responsibleJobPositionId: null,
    responsibleOrgUnitId: finding.targetOrgUnitId,
    progressPercent: 0,
    startDate: now.slice(0, 10),
    dueDate: null,
    completedDate: null,
    status: "assigned",
    managerComment: "",
    createdAt: now,
    updatedAt: now,
  }));

  writeStore({
    ...data,
    actions: [...createdActions, ...data.actions],
  });
  return createdActions.length;
}

export function upsertCorrectiveAction(input: {
  id?: string | null;
  findingId: string;
  actionText: string;
  responsibleEmployeeId?: string | null;
  responsibleJobPositionId?: string | null;
  responsibleOrgUnitId?: string | null;
  progressPercent?: number | null;
  startDate?: string | null;
  dueDate?: string | null;
  completedDate?: string | null;
  status?: CorrectiveAction["status"];
  managerComment?: string;
}): CorrectiveAction {
  const data = readStore();
  const finding = data.findings.find((item) => item.id === input.findingId);
  if (!finding) throw new Error("Finding not found");

  const existing = input.id
    ? data.actions.find((item) => item.id === input.id)
    : data.actions.find((item) => item.findingId === input.findingId);
  const now = new Date().toISOString();
  const progressPercent = Math.max(
    0,
    Math.min(100, Number(input.progressPercent ?? existing?.progressPercent ?? 0)),
  );
  const status = input.status ?? existing?.status ?? "assigned";
  const completedDate =
    input.completedDate ||
    existing?.completedDate ||
    (status === "closed" || status === "verified" || progressPercent >= 100
      ? now.slice(0, 10)
      : null);

  const action: CorrectiveAction = {
    id: existing?.id ?? input.id ?? randomUUID(),
    findingId: input.findingId,
    actionText: input.actionText || existing?.actionText || "Зөрчлийг арилгах арга хэмжээ төлөвлөх",
    responsibleEmployeeId:
      input.responsibleEmployeeId ?? existing?.responsibleEmployeeId ?? null,
    responsibleJobPositionId:
      input.responsibleJobPositionId ?? existing?.responsibleJobPositionId ?? null,
    responsibleOrgUnitId:
      input.responsibleOrgUnitId ?? existing?.responsibleOrgUnitId ?? finding.targetOrgUnitId,
    progressPercent,
    startDate: input.startDate ?? existing?.startDate ?? now.slice(0, 10),
    dueDate: input.dueDate ?? existing?.dueDate ?? null,
    completedDate,
    status,
    managerComment: input.managerComment ?? existing?.managerComment ?? "",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const closesFinding =
    action.status === "closed" ||
    action.status === "verified" ||
    action.progressPercent >= 100;
  const nextFindings = data.findings.map((item) => {
    if (item.id !== finding.id) return item;
    return {
      ...item,
      status: closesFinding ? "resolved" : item.status === "open" ? "in_progress" : item.status,
      updatedAt: now,
    };
  });

  writeStore({
    ...data,
    findings: nextFindings,
    actions: existing
      ? data.actions.map((item) => (item.id === existing.id ? action : item))
      : [action, ...data.actions],
  });
  return action;
}

export function deleteResolvedFindingArchiveRow(findingId: string) {
  const data = readStore();
  const finding = data.findings.find((item) => item.id === findingId);
  if (!finding) return;
  if (finding.status !== "resolved" && finding.status !== "closed") {
    throw new Error("Only resolved archive rows can be deleted");
  }

  const actionIds = new Set(
    data.actions
      .filter((action) => action.findingId === findingId)
      .map((action) => action.id),
  );

  writeStore({
    ...data,
    findings: data.findings.filter((item) => item.id !== findingId),
    actions: data.actions.filter((action) => action.findingId !== findingId),
    evidence: data.evidence.filter(
      (item) =>
        item.findingId !== findingId &&
        (!item.actionId || !actionIds.has(item.actionId)),
    ),
  });
}

export function getDashboardMetrics(data: InspectionCenterData) {
  const closedActions = data.actions.filter((a) => a.status === "closed");
  const resolvedFindings = data.findings.filter(
    (f) => f.status === "resolved" || f.status === "closed",
  );
  const scores = data.scoreSnapshots;
  const avgCompliance =
    scores.length === 0
      ? 0
      : scores.reduce((s, x) => s + x.compliancePercent, 0) / scores.length;
  const avgRisk =
    scores.length === 0
      ? 0
      : scores.reduce((s, x) => s + x.riskPercent, 0) / scores.length;

  return {
    inspectionCount: data.runs.length,
    planCount: data.plans.length,
    templateCount: data.templates.length,
    violationCount: data.findings.length,
    resolvedViolationCount: resolvedFindings.length,
    compliancePercent: avgCompliance,
    riskPercent: avgRisk,
    actionProgress:
      data.actions.length === 0
        ? 0
        : data.actions.reduce((s, a) => s + a.progressPercent, 0) /
          data.actions.length /
          100,
    actionCompletion:
      data.actions.length === 0
        ? 0
        : closedActions.length / data.actions.length,
    byType: groupCount(data.runs.map((r) => r.inspectionType)),
    evidenceCount: data.evidence.length,
  };
}

function groupCount(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, v) => {
    acc[v] = (acc[v] ?? 0) + 1;
    return acc;
  }, {});
}

export function setRiskThresholds(thresholds: RiskThresholds) {
  const data = readStore();
  const riskThresholds = normalizeRiskThresholds(thresholds);
  writeStore({
    ...data,
    riskThresholds,
    scoreSnapshots: data.scoreSnapshots.map((snapshot) => ({
      ...snapshot,
      riskLevel: mapRiskLevel(snapshot.riskPercent, riskThresholds),
    })),
  });
}
