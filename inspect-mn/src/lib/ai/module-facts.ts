import { loadAppDataPayload } from "@/lib/risk/store-payload";
import type { UnitScope } from "@/lib/rbac/unit-scope";
import { matchesUnitText } from "@/lib/rbac/unit-scope";
import type { AiDataSource } from "@/lib/ai/scope-config";
import type { AiResolvedScope } from "@/lib/ai/resolve-scope";
import {
  retrieveInspectionDetail,
  retrievePolicyContent,
} from "@/lib/ai/retrieve-content";
import { defaultSmartMineRange } from "@/lib/smartmine/constants";
import { buildSmartMineOverview } from "@/lib/smartmine/overview";
import type { GuidanceRecord } from "@/lib/guidance/types";

type Policy = {
  id: string;
  name?: string | null;
  reference_code?: string | null;
  is_deleted?: boolean;
  status?: string | null;
};

type Clause = {
  id: string;
  policy_id: string;
  is_deleted?: boolean;
};

type Position = {
  id: string;
  name?: string | null;
  heltes_id?: string | null;
  alba_id?: string | null;
  heltes_name?: string | null;
  alba_name?: string | null;
  organization_name?: string | null;
};

type Evaluation = {
  id: string;
  policy_clause_id: string;
  job_position_id: string;
  status: string;
  score: number;
};

type PolicyDb = {
  policies?: Policy[];
  policy_clauses?: Clause[];
  job_positions?: Position[];
  compliance_evaluations?: Evaluation[];
};

type PolicyOrgOverride = {
  orgs: Array<{ type: "heltes" | "alba"; id: string }> | null;
  policy_name?: string;
};

type PolicyOrgOverridesFile = Record<string, PolicyOrgOverride>;

type InspectionStore = {
  findings?: Array<{ id: string; status?: string; runId?: string }>;
  runs?: Array<{ id: string; inspectedByOrg?: string }>;
  actions?: Array<{ findingId: string; status?: string }>;
  templates?: Array<{ id: string }>;
  annualPlans?: Array<{ id: string }>;
};

type GuidanceDb = { items?: GuidanceRecord[] };

export type AiModuleFacts = {
  lines: string[];
  kpis: Array<{ label: string; value: string; hint: string }>;
  sourceErrors: Record<string, string>;
};

function positionMatchesUnit(pos: Position, scope: UnitScope): boolean {
  if (!scope.active) return true;
  if (scope.heltesId && pos.heltes_id && pos.heltes_id === scope.heltesId) {
    return true;
  }
  if (scope.albaId && pos.alba_id && pos.alba_id === scope.albaId) {
    return true;
  }
  const label = [pos.heltes_name, pos.alba_name, pos.organization_name]
    .filter(Boolean)
    .join(" ");
  return matchesUnitText(label, scope);
}

function policyMatchesUnit(
  policyId: string,
  overrides: PolicyOrgOverridesFile,
  scope: UnitScope,
): boolean {
  if (!scope.active) return true;
  const ov = overrides[policyId];
  if (!ov || ov.orgs == null) return false;
  return ov.orgs.some((org) => {
    if (org.type === "heltes" && scope.heltesId && org.id === scope.heltesId) {
      return true;
    }
    if (org.type === "alba" && scope.albaId && org.id === scope.albaId) {
      return true;
    }
    return false;
  });
}

async function policyFacts(
  scope: AiResolvedScope,
): Promise<AiModuleFacts> {
  if (scope.mode === "none") {
    return {
      lines: [
        "Журам: нэгжийн оноолгоогүй тул журмын тоо/үнэлгээ харуулахгүй.",
      ],
      kpis: [],
      sourceErrors: {},
    };
  }

  const [db, overrides] = await Promise.all([
    loadAppDataPayload<PolicyDb>("policy_compliance_db"),
    loadAppDataPayload<PolicyOrgOverridesFile>(
      "policy_compliance_policy_org_overrides",
    ),
  ]);

  if (!db) {
    return {
      lines: [],
      kpis: [],
      sourceErrors: { policy: "policy_compliance_db олдсонгүй" },
    };
  }

  const policies = (db.policies ?? []).filter((p) => !p.is_deleted);
  const clauses = (db.policy_clauses ?? []).filter((c) => !c.is_deleted);
  const positions = db.job_positions ?? [];
  const evaluations = db.compliance_evaluations ?? [];
  const ov = overrides ?? {};

  let scopedPolicies = policies;
  if (scope.unitScope.active) {
    const byOrg = policies.filter((p) =>
      policyMatchesUnit(p.id, ov, scope.unitScope),
    );
    if (byOrg.length > 0) {
      scopedPolicies = byOrg;
    } else {
      const unitPosIds = new Set(
        positions
          .filter((p) => positionMatchesUnit(p, scope.unitScope))
          .map((p) => p.id),
      );
      const clauseById = new Map(clauses.map((c) => [c.id, c]));
      const policyIds = new Set<string>();
      for (const e of evaluations) {
        if (!unitPosIds.has(e.job_position_id)) continue;
        const clause = clauseById.get(e.policy_clause_id);
        if (clause) policyIds.add(clause.policy_id);
      }
      scopedPolicies = policies.filter((p) => policyIds.has(p.id));
    }
  }

  const scopedPolicyIds = new Set(scopedPolicies.map((p) => p.id));
  const scopedClauses = clauses.filter((c) => scopedPolicyIds.has(c.policy_id));
  const unitPositions = scope.unitScope.active
    ? positions.filter((p) => positionMatchesUnit(p, scope.unitScope))
    : positions;
  const unitPosIds = new Set(unitPositions.map((p) => p.id));
  const scopedEvals = scope.unitScope.active
    ? evaluations.filter((e) => unitPosIds.has(e.job_position_id))
    : evaluations;

  const atRisk = scopedEvals.filter(
    (e) =>
      e.status === "non_compliant" ||
      e.status === "partially_compliant" ||
      ((e.status === "in_progress" || e.status === "not_started") &&
        (e.score ?? 0) < 80),
  ).length;

  const avgScore =
    scopedEvals.length === 0
      ? null
      : Math.round(
          scopedEvals.reduce((s, e) => s + (e.score || 0), 0) /
            scopedEvals.length,
        );

  const scopeTag =
    scope.mode === "all"
      ? "платформ нийт"
      : [scope.unitScope.heltesName, scope.unitScope.albaName]
          .filter(Boolean)
          .join(" · ") || "нэгж";

  const kpis = [
    {
      label: "Бүртгэгдсэн журам",
      value: String(scopedPolicies.length),
      hint: scopeTag,
    },
    {
      label: "Журмын заалт",
      value: String(scopedClauses.length),
      hint: scopeTag,
    },
    {
      label: "Үнэлгээ (бичлэг)",
      value: String(scopedEvals.length),
      hint: avgScore == null ? "дундаж —" : `дундаж ${avgScore}%`,
    },
    {
      label: "Анхаарах үнэлгээ",
      value: String(atRisk),
      hint: "нийцээгүй / бага оноо",
    },
  ];

  const sampleNames = scopedPolicies
    .slice(0, 8)
    .map((p) => p.reference_code || p.name || p.id);

  const lines = [
    `Журмын биелэлт (${scopeTag}):`,
    `- Нийт бүртгэгдсэн журам: ${scopedPolicies.length}`,
    `- Заалт: ${scopedClauses.length}`,
    `- Ажлын байр (хамрах): ${unitPositions.length}`,
    `- Үнэлгээний бичлэг: ${scopedEvals.length}`,
    `- Анхаарах үнэлгээ: ${atRisk}`,
    avgScore == null ? "- Дундаж оноо: —" : `- Дундаж оноо: ${avgScore}%`,
  ];
  if (sampleNames.length) {
    lines.push(`- Жишээ журам: ${sampleNames.join("; ")}`);
  }

  return { lines, kpis, sourceErrors: {} };
}

async function inspectionFacts(
  scope: AiResolvedScope,
): Promise<AiModuleFacts> {
  if (scope.mode === "none") {
    return {
      lines: ["ХШ: нэгжийн оноолгоогүй тул шалгалтын тоо харуулахгүй."],
      kpis: [],
      sourceErrors: {},
    };
  }

  const store = await loadAppDataPayload<InspectionStore>(
    "inspection_center_store",
  );
  if (!store) {
    return {
      lines: [],
      kpis: [],
      sourceErrors: { inspection: "inspection_center_store олдсонгүй" },
    };
  }

  let runs = store.runs ?? [];
  if (scope.unitScope.active) {
    runs = runs.filter((r) => matchesUnitText(r.inspectedByOrg, scope.unitScope));
  }
  const runIds = new Set(runs.map((r) => r.id));
  let findings = store.findings ?? [];
  if (scope.unitScope.active) {
    findings = findings.filter((f) => f.runId && runIds.has(f.runId));
  }

  const scopeTag =
    scope.mode === "all"
      ? "платформ нийт"
      : [scope.unitScope.heltesName, scope.unitScope.albaName]
          .filter(Boolean)
          .join(" · ") || "нэгж";

  const kpis = [
    {
      label: "Шалгалтын гүйлгээ",
      value: String(runs.length),
      hint: scopeTag,
    },
    {
      label: "Зөрчил / олдвор",
      value: String(findings.length),
      hint: scopeTag,
    },
    {
      label: "ХШ загвар",
      value: String((store.templates ?? []).length),
      hint: scope.mode === "all" ? "нийт" : "каталог (шүүлтгүй)",
    },
  ];

  return {
    lines: [
      `Хяналт шалгалт (${scopeTag}):`,
      `- Гүйлгээ: ${runs.length}`,
      `- Олдвор: ${findings.length}`,
      `- Үйлдэл: ${(store.actions ?? []).length}`,
      `- Загвар: ${(store.templates ?? []).length}`,
      `- Жилийн төлөвлөгөө: ${(store.annualPlans ?? []).length}`,
    ],
    kpis,
    sourceErrors: {},
  };
}

async function smartMineFacts(scope: AiResolvedScope): Promise<AiModuleFacts> {
  if (scope.mode === "none") {
    return { lines: [], kpis: [], sourceErrors: {} };
  }
  if (scope.mode === "unit") {
    return {
      lines: [
        "SmartMine: өгөгдөл нь хэлтэс/албаны хэмжээсгүй тул нэгжийн хүрээнд AI-д харуулахгүй.",
      ],
      kpis: [],
      sourceErrors: {},
    };
  }

  try {
    const range = defaultSmartMineRange();
    const overview = await buildSmartMineOverview(range);
    const topReason = overview.reasons[0];
    return {
      lines: [
        `SmartMine (${range.from} → ${range.to}):`,
        `- Ore feed: ${overview.processing.oreFeedTons} т`,
        `- Concentrate: ${overview.processing.concentrateTons} т`,
        `- Recovery: ${overview.processing.recoveryPercent}%`,
        `- Work order: ${overview.maintenance.workOrders}`,
        `- Downtime: ${overview.maintenance.downtimeHours} цаг`,
        `- MTTR: ${overview.maintenance.mttrHours} цаг`,
        `- Top downtime equipment: ${overview.maintenance.topEquipment}`,
        topReason
          ? `- Гол шалтгааны candidate: ${topReason.title} — ${topReason.detail}`
          : "- Гол шалтгааны candidate: —",
      ],
      kpis: [
        { label: "SmartMine Ore feed", value: String(overview.processing.oreFeedTons), hint: "т" },
        { label: "SmartMine Concentrate", value: String(overview.processing.concentrateTons), hint: "т" },
        { label: "SmartMine Recovery", value: String(overview.processing.recoveryPercent), hint: "%" },
        { label: "SmartMine Downtime", value: String(overview.maintenance.downtimeHours), hint: "цаг" },
        { label: "SmartMine MTTR", value: String(overview.maintenance.mttrHours), hint: "цаг" },
      ],
      sourceErrors: overview.warning ? { smartmine: overview.warning } : {},
    };
  } catch (error) {
    return {
      lines: [],
      kpis: [],
      sourceErrors: {
        smartmine:
          error instanceof Error ? error.message : "SmartMine өгөгдөл уншиж чадсангүй",
      },
    };
  }
}

async function guidanceFacts(
  scope: AiResolvedScope,
): Promise<AiModuleFacts> {
  if (scope.mode === "none") {
    return {
      lines: ["Удирдамж: нэгжийн оноолгоогүй тул удирдамжийн тоо харуулахгүй."],
      kpis: [],
      sourceErrors: {},
    };
  }

  const db = await loadAppDataPayload<GuidanceDb>("platform_guidance_db");
  if (!db) {
    return {
      lines: [],
      kpis: [],
      sourceErrors: { guidance: "platform_guidance_db олдсонгүй" },
    };
  }

  const items = db.items ?? [];
  const active = items.filter((r) => r.status === "in_progress");
  const completed = items.filter((r) => r.status === "completed");
  const blocked = items.filter((r) => r.status === "blocked");
  const avgProgress =
    items.length === 0
      ? 0
      : Math.round(items.reduce((s, r) => s + (r.progress || 0), 0) / items.length);

  const scopeTag =
    scope.mode === "all"
      ? "платформ нийт"
      : [scope.unitScope.heltesName, scope.unitScope.albaName]
          .filter(Boolean)
          .join(" · ") || "нэгж";

  const kpis = [
    { label: "Удирдамж (нийт)", value: String(items.length), hint: scopeTag },
    { label: "Гүйцэтгэлд байгаа", value: String(active.length), hint: "in_progress" },
    { label: "Дууссан", value: String(completed.length), hint: "completed" },
    { label: "Блокирогдсон", value: String(blocked.length), hint: "blocked" },
    { label: "Дундаж прогресс", value: `${avgProgress}%`, hint: scopeTag },
  ];

  const topItems = items
    .filter((r) => r.status !== "completed")
    .sort((a, b) => (a.progress || 0) - (b.progress || 0))
    .slice(0, 5);

  const lines = [
    `Удирдамж (${scopeTag}):`,
    `- Нийт: ${items.length}`,
    `- Гүйцэтгэлд: ${active.length}`,
    `- Дууссан: ${completed.length}`,
    `- Блокирогдсон: ${blocked.length}`,
    `- Дундаж прогресс: ${avgProgress}%`,
  ];
  if (topItems.length) {
    lines.push(
      `- Шаардлагатай (бага прогресс): ${topItems.map((r) => `${r.title} (${r.progress}%)`).join("; ")}`,
    );
  }

  return { lines, kpis, sourceErrors: {} };
}

export async function buildAiModuleFacts(
  scope: AiResolvedScope,
  query?: string | null,
  moduleFilter?: string | null,
): Promise<AiModuleFacts> {
  const wanted = new Set(scope.sources);
  const parts: AiModuleFacts[] = [];

  if (wanted.has("policy")) parts.push(await policyFacts(scope));
  if (wanted.has("inspection")) parts.push(await inspectionFacts(scope));
  if (wanted.has("guidance")) parts.push(await guidanceFacts(scope));
  if (
    wanted.has("smartmine") &&
    (!moduleFilter ||
      moduleFilter === "general" ||
      moduleFilter === "smartmine" ||
      moduleFilter === "reports")
  ) {
    parts.push(await smartMineFacts(scope));
  }

  const q = (query ?? "").trim();
  const mod = moduleFilter ?? "general";
  if (q.length >= 2) {
    const wantPolicyContent =
      wanted.has("policy_content") &&
      (mod === "general" || mod === "policy" || mod === "reports");
    const wantInspectionDetail =
      wanted.has("inspection_detail") &&
      (mod === "general" || mod === "inspection" || mod === "reports" || mod === "risk");

    if (wantPolicyContent) {
      const contentLines = await retrievePolicyContent(scope, q);
      if (contentLines.length) {
        parts.push({ lines: contentLines, kpis: [], sourceErrors: {} });
      }
    }
    if (wantInspectionDetail) {
      const detailLines = await retrieveInspectionDetail(scope, q);
      if (detailLines.length) {
        parts.push({ lines: detailLines, kpis: [], sourceErrors: {} });
      }
    }
  }

  const lines: string[] = [];
  const kpis: AiModuleFacts["kpis"] = [];
  const sourceErrors: Record<string, string> = {};
  for (const part of parts) {
    lines.push(...part.lines);
    kpis.push(...part.kpis);
    Object.assign(sourceErrors, part.sourceErrors);
  }

  return { lines, kpis, sourceErrors };
}

export function sourceAllowed(
  source: AiDataSource,
  sources: AiDataSource[],
): boolean {
  return sources.includes(source);
}
