import { avg } from "@/lib/utils";
import { readDb, updateDb, newId, type LocalDatabase } from "./local-store";
import type {
  ClausePositionResponsibility,
  ClauseTreeNode,
  ComplianceEvaluation,
  DataQualityWarning,
  EvaluationEvidence,
  JobDescription,
  JobPosition,
  Policy,
  PolicyClause,
  PolicySection,
  ResponsibilityType,
} from "@/lib/types";

export async function getDb() {
  return readDb();
}

export function buildClauseTree(
  clauses: PolicyClause[],
  responsibilities: ClausePositionResponsibility[],
  sectionId?: string | null,
): ClauseTreeNode[] {
  const filtered = clauses.filter((c) =>
    sectionId == null ? true : c.section_id === sectionId,
  );
  const byParent = new Map<string | null, PolicyClause[]>();
  for (const c of filtered) {
    const key = c.parent_id;
    const list = byParent.get(key) ?? [];
    list.push(c);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => {
      const ao = a.sort_order - b.sort_order;
      if (ao !== 0) return ao;
      return (a.reference_number ?? "").localeCompare(b.reference_number ?? "", undefined, {
        numeric: true,
      });
    });
  }

  const respByClause = new Map<string, ClausePositionResponsibility[]>();
  for (const r of responsibilities) {
    const list = respByClause.get(r.policy_clause_id) ?? [];
    list.push(r);
    respByClause.set(r.policy_clause_id, list);
  }

  function walk(parentId: string | null): ClauseTreeNode[] {
    return (byParent.get(parentId) ?? []).map((c) => ({
      ...c,
      children: walk(c.id),
      responsibilities: respByClause.get(c.id) ?? [],
    }));
  }

  // Roots: parent null, or parent outside this section filter
  const ids = new Set(filtered.map((c) => c.id));
  const roots = filtered.filter((c) => !c.parent_id || !ids.has(c.parent_id));
  const rootIds = new Set(roots.map((r) => r.id));

  return roots
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => ({
      ...c,
      children: walk(c.id).filter((ch) => !rootIds.has(ch.id) || ch.parent_id === c.id),
      responsibilities: respByClause.get(c.id) ?? [],
    }));
}

export async function getDashboardStats() {
  const db = await readDb();
  const activePolicies = db.policies.filter((p) => !p.is_deleted);
  const clauses = db.policy_clauses.filter((c) => !c.is_deleted);
  const positions = db.job_positions.filter((p) => p.is_active);
  const links = db.clause_position_responsibilities.filter((l) => l.is_active);
  const evals = evaluationsWithActiveLinks(
    db.compliance_evaluations,
    db.clause_position_responsibilities,
  );
  const latest = latestEvaluations(evals);

  const byType: Record<ResponsibilityType, number[]> = {
    IMPLEMENTATION: [],
    MONITORING: [],
    VERIFICATION: [],
    DEPLOYMENT: [],
  };
  for (const e of latest) {
    byType[e.responsibility_type].push(e.score);
  }

  const orgByBteg = new Map(
    db.org_units.filter((u) => u.bteg_id).map((u) => [u.bteg_id as string, u.name]),
  );

  /** heltes_name → set of alba_name seen on positions */
  const albasByHeltes = new Map<string, Set<string>>();
  for (const p of positions) {
    const heltes =
      (p.heltes_name && p.heltes_name.trim()) ||
      (p.heltes_id && orgByBteg.get(p.heltes_id)) ||
      "";
    const alba = p.alba_name?.trim();
    if (!heltes || !alba) continue;
    const set = albasByHeltes.get(heltes) ?? new Set<string>();
    set.add(alba);
    albasByHeltes.set(heltes, set);
  }

  function heltesHasRealAlbas(heltesName: string): boolean {
    const set = albasByHeltes.get(heltesName);
    if (!set || set.size === 0) return false;
    if (set.size > 1) return true;
    const only = [...set][0];
    const nHeltes = heltesName.toLocaleLowerCase("mn");
    const nAlba = only.toLocaleLowerCase("mn");
    if (nAlba === nHeltes) return false;
    return /алба|нэгж/u.test(nAlba);
  }

  function resolveHeltesName(pos: (typeof positions)[number] | undefined): string {
    if (!pos) return "Ангилагдаагүй";
    return (
      (pos.heltes_name && pos.heltes_name.trim()) ||
      (pos.heltes_id && orgByBteg.get(pos.heltes_id)) ||
      (pos.alba_name && pos.alba_name.trim()) ||
      (pos.alba_id && orgByBteg.get(pos.alba_id)) ||
      "Ангилагдаагүй"
    );
  }

  /** Албатай хэлтэс → алба; албагүй → хэлтэс */
  function resolveUnitName(pos: (typeof positions)[number] | undefined): string {
    if (!pos) return "Ангилагдаагүй";
    const heltes = resolveHeltesName(pos);
    const alba = pos.alba_name?.trim();
    if (heltesHasRealAlbas(heltes) && alba) return alba;
    return heltes;
  }

  const deptMap = new Map<string, number[]>();
  const unitMap = new Map<string, number[]>();
  const relatedPoliciesByHeltes = new Map<string, Set<string>>();
  const evaluatedPoliciesByHeltes = new Map<string, Set<string>>();
  const clauseToPolicy = new Map(clauses.map((c) => [c.id, c.policy_id]));
  const positionById = new Map(db.job_positions.map((p) => [p.id, p]));

  for (const link of links) {
    const pos = positionById.get(link.job_position_id);
    const heltesKey = resolveHeltesName(pos);
    const policyId = clauseToPolicy.get(link.policy_clause_id);
    if (!policyId) continue;
    const set = relatedPoliciesByHeltes.get(heltesKey) ?? new Set<string>();
    set.add(policyId);
    relatedPoliciesByHeltes.set(heltesKey, set);
  }

  for (const e of latest) {
    const pos = positionById.get(e.job_position_id);
    const heltesKey = resolveHeltesName(pos);
    const unitKey = resolveUnitName(pos);
    const dList = deptMap.get(heltesKey) ?? [];
    dList.push(e.score);
    deptMap.set(heltesKey, dList);
    const uList = unitMap.get(unitKey) ?? [];
    uList.push(e.score);
    unitMap.set(unitKey, uList);

    const policyId = clauseToPolicy.get(e.policy_clause_id);
    if (policyId) {
      const set = evaluatedPoliciesByHeltes.get(heltesKey) ?? new Set<string>();
      set.add(policyId);
      evaluatedPoliciesByHeltes.set(heltesKey, set);
      // Үнэлгээтэй журам нь холбогдох журамд тооцогдоно
      const related = relatedPoliciesByHeltes.get(heltesKey) ?? new Set<string>();
      related.add(policyId);
      relatedPoliciesByHeltes.set(heltesKey, related);
    }
  }

  const deptAvgs = [...deptMap.entries()]
    .map(([name, scores]) => ({
      name,
      avg: avg(scores) ?? 0,
      count: scores.length,
      relatedPolicyCount: relatedPoliciesByHeltes.get(name)?.size ?? 0,
      evaluatedPolicyCount: evaluatedPoliciesByHeltes.get(name)?.size ?? 0,
    }))
    .sort((a, b) => a.avg - b.avg);

  const unitAvgs = [...unitMap.entries()]
    .map(([name, scores]) => ({ name, avg: avg(scores) ?? 0, count: scores.length }))
    .sort((a, b) => a.avg - b.avg);

  return {
    totalPolicies: activePolicies.length,
    totalClauses: clauses.length,
    totalPositions: positions.length,
    totalLinks: links.length,
    evaluationCount: evals.length,
    evaluationCompletionRate:
      links.length === 0
        ? 0
        : Math.round((new Set(latest.map((e) => `${e.policy_clause_id}:${e.job_position_id}:${e.responsibility_type}`)).size / links.length) * 1000) / 10,
    averageScore: avg(latest.map((e) => e.score)),
    nonCompliantCount: latest.filter((e) => e.score < 40 || e.status === "non_compliant").length,
    highRiskDepartments: deptAvgs.slice(0, 5),
    lowestAverageUnit: unitAvgs[0] ?? null,
    scoreByResponsibility: (Object.keys(byType) as ResponsibilityType[]).map((t) => ({
      type: t,
      avg: avg(byType[t]),
      count: byType[t].length,
    })),
    importReport: db.meta.import_report,
    importedAt: db.meta.imported_at,
  };
}

export function evaluationLinkKey(
  e: Pick<
    ComplianceEvaluation,
    "policy_clause_id" | "job_position_id" | "responsibility_type"
  >,
) {
  return `${e.policy_clause_id}:${e.job_position_id}:${e.responsibility_type}`;
}

export function activeResponsibilityKeys(
  links: ClausePositionResponsibility[],
): Set<string> {
  return new Set(
    links
      .filter((l) => l.is_active)
      .map(
        (l) =>
          `${l.policy_clause_id}:${l.job_position_id}:${l.responsibility_type}`,
      ),
  );
}

/** Drop scores whose responsibility link was soft-unlinked (is_active=false). */
export function evaluationsWithActiveLinks(
  evals: ComplianceEvaluation[],
  links: ClausePositionResponsibility[],
): ComplianceEvaluation[] {
  const keys = activeResponsibilityKeys(links);
  return evals.filter((e) => keys.has(evaluationLinkKey(e)));
}

export function latestEvaluations(evals: ComplianceEvaluation[]): ComplianceEvaluation[] {
  const map = new Map<string, ComplianceEvaluation>();
  for (const e of [...evals].sort(
    (a, b) => new Date(b.evaluated_at).getTime() - new Date(a.evaluated_at).getTime(),
  )) {
    const key = evaluationLinkKey(e);
    if (!map.has(key)) map.set(key, e);
  }
  return [...map.values()];
}

export async function listPolicies(q?: string) {
  const db = await readDb();
  let items = db.policies.filter((p) => !p.is_deleted);
  if (q) {
    const s = q.toLowerCase();
    items = items.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        (p.reference_code ?? "").toLowerCase().includes(s),
    );
  }
  return items.sort((a, b) => (b.approved_date ?? "").localeCompare(a.approved_date ?? ""));
}

export async function getPolicyDetail(id: string) {
  const db = await readDb();
  const policy = db.policies.find((p) => p.id === id && !p.is_deleted);
  if (!policy) return null;
  const sections = db.policy_sections
    .filter((s) => s.policy_id === id && !s.is_deleted)
    .sort((a, b) => a.sort_order - b.sort_order);
  const clauses = db.policy_clauses.filter((c) => c.policy_id === id && !c.is_deleted);
  const clauseIds = new Set(clauses.map((c) => c.id));
  const responsibilities = db.clause_position_responsibilities.filter(
    (r) => clauseIds.has(r.policy_clause_id) && r.is_active,
  );
  const positionIds = new Set(responsibilities.map((r) => r.job_position_id));
  const positions = db.job_positions.filter((p) => positionIds.has(p.id));
  const scope = db.policy_scope_targets.filter((s) => s.policy_id === id);
  const activeKeys = activeResponsibilityKeys(responsibilities);
  const latest = latestEvaluations(
    db.compliance_evaluations.filter(
      (e) =>
        clauseIds.has(e.policy_clause_id) &&
        activeKeys.has(evaluationLinkKey(e)),
    ),
  );

  const trees = sections.map((section) => ({
    section,
    tree: buildClauseTree(clauses, responsibilities, section.id),
  }));

  // Orphan clauses without section
  const sectionIds = new Set(sections.map((s) => s.id));
  const orphans = clauses.filter((c) => !c.section_id || !sectionIds.has(c.section_id));
  if (orphans.length) {
    trees.push({
      section: {
        id: "orphan",
        policy_id: id,
        text: "Хэсэггүй",
        reference_number: null,
        sort_order: 9999,
        is_deleted: false,
      },
      tree: buildClauseTree(orphans, responsibilities, null),
    });
  }

  return {
    policy,
    sections,
    clauses,
    responsibilities,
    positions,
    scope,
    trees,
    latestEvaluations: latest,
    avgScore: avg(latest.map((e) => e.score)),
  };
}

export async function listPositions(q?: string) {
  const db = await readDb();
  let items = db.job_positions.filter((p) => p.is_active);
  if (q) {
    const s = q.toLowerCase();
    items = items.filter(
      (p) =>
        p.name.toLowerCase().includes(s) ||
        (p.bteg_id ?? "").includes(s) ||
        (p.official_code ?? "").toLowerCase().includes(s) ||
        (p.heltes_id ?? "").includes(s) ||
        (p.alba_id ?? "").includes(s) ||
        (p.heltes_name ?? "").toLowerCase().includes(s) ||
        (p.alba_name ?? "").toLowerCase().includes(s) ||
        (p.organization_id ?? "").includes(s),
    );
  }
  return items.sort((a, b) => a.name.localeCompare(b.name, "mn"));
}

export async function getPositionDetail(id: string) {
  const { resolveJobPositionRef } = await import("@/lib/access/resolve-position");
  const { listOrgVisiblePolicyIdsForPosition } = await import("@/lib/db/org");
  const resolved = await resolveJobPositionRef(id);
  const positionId = resolved?.id ?? id;
  const db = await readDb();
  const position = db.job_positions.find((p) => p.id === positionId);
  if (!position) return null;
  const description =
    db.job_descriptions.find((d) => d.job_position_id === positionId) ?? null;
  const links = db.clause_position_responsibilities.filter(
    (r) => r.job_position_id === positionId && r.is_active,
  );
  const clauseIds = new Set(links.map((l) => l.policy_clause_id));
  let clauses = db.policy_clauses.filter((c) => clauseIds.has(c.id) && !c.is_deleted);
  const policyIds = new Set(clauses.map((c) => c.policy_id));

  // Org-wide / heltes / alba assigned policies → all clauses visible
  const orgVisible = await listOrgVisiblePolicyIdsForPosition(positionId);
  for (const pid of orgVisible) {
    policyIds.add(pid);
  }
  const orgOnlyClauseIds = new Set<string>();
  if (orgVisible.size) {
    for (const c of db.policy_clauses) {
      if (c.is_deleted || !orgVisible.has(c.policy_id)) continue;
      if (!clauseIds.has(c.id)) {
        clauseIds.add(c.id);
        orgOnlyClauseIds.add(c.id);
        clauses.push(c);
      }
    }
  }

  const policies = db.policies.filter((p) => policyIds.has(p.id) && !p.is_deleted);
  const activeKeys = activeResponsibilityKeys(links);
  const evals = db.compliance_evaluations
    .filter(
      (e) =>
        e.job_position_id === positionId &&
        activeKeys.has(evaluationLinkKey(e)),
    )
    .sort((a, b) => new Date(b.evaluated_at).getTime() - new Date(a.evaluated_at).getTime());
  const latest = latestEvaluations(evals);

  const obligations = links.map((link) => {
    const clause = clauses.find((c) => c.id === link.policy_clause_id);
    const policy = policies.find((p) => p.id === clause?.policy_id);
    const evaluation = latest.find(
      (e) =>
        e.policy_clause_id === link.policy_clause_id &&
        e.responsibility_type === link.responsibility_type,
    );
    return { link, clause, policy, evaluation };
  });

  // Synthetic read-only obligations for org-scoped clauses without personal links
  for (const clauseId of orgOnlyClauseIds) {
    const clause = clauses.find((c) => c.id === clauseId);
    if (!clause) continue;
    const policy = policies.find((p) => p.id === clause.policy_id);
    obligations.push({
      link: {
        id: `org-scope:${clauseId}`,
        policy_clause_id: clauseId,
        job_position_id: positionId,
        responsibility_type: "IMPLEMENTATION",
        is_checked: true,
        is_active: true,
        weight: 1,
        required_evidence: null,
        notes: "Байгууллагын/нэгжийн нийтлэг хамрах хүрээ",
      },
      clause,
      policy,
      evaluation: undefined,
    });
  }

  return {
    position,
    description,
    obligations,
    policies,
    evaluations: evals,
    latestEvaluations: latest,
    avgScore: avg(latest.map((e) => e.score)),
    counts: {
      clauses: clauseIds.size,
      policies: policyIds.size,
      implementation: links.filter((l) => l.responsibility_type === "IMPLEMENTATION").length,
      monitoring: links.filter((l) => l.responsibility_type === "MONITORING").length,
      verification: links.filter((l) => l.responsibility_type === "VERIFICATION").length,
      deployment: links.filter((l) => l.responsibility_type === "DEPLOYMENT").length,
    },
  };
}

export async function getMatrixRows(filters?: {
  policyId?: string;
  responsibilityType?: ResponsibilityType;
  q?: string;
}) {
  const db = await readDb();
  const clauseMap = new Map(db.policy_clauses.map((c) => [c.id, c]));
  const policyMap = new Map(db.policies.map((p) => [p.id, p]));
  const positionMap = new Map(db.job_positions.map((p) => [p.id, p]));
  const latest = latestEvaluations(
    evaluationsWithActiveLinks(
      db.compliance_evaluations,
      db.clause_position_responsibilities,
    ),
  );
  const latestMap = new Map(
    latest.map((e) => [evaluationLinkKey(e), e]),
  );

  let links = db.clause_position_responsibilities.filter((l) => l.is_active);
  if (filters?.responsibilityType) {
    links = links.filter((l) => l.responsibility_type === filters.responsibilityType);
  }
  if (filters?.policyId) {
    links = links.filter((l) => clauseMap.get(l.policy_clause_id)?.policy_id === filters.policyId);
  }

  const rows = links.map((link) => {
    const clause = clauseMap.get(link.policy_clause_id);
    const policy = clause ? policyMap.get(clause.policy_id) : undefined;
    const position = positionMap.get(link.job_position_id);
    const evaluation =
      latestMap.get(
        `${link.policy_clause_id}:${link.job_position_id}:${link.responsibility_type}`,
      ) ?? null;
    return { link, clause, policy, position, evaluation };
  });

  if (filters?.q) {
    const s = filters.q.toLowerCase();
    return rows.filter(
      (r) =>
        (r.policy?.name ?? "").toLowerCase().includes(s) ||
        (r.clause?.reference_number ?? "").toLowerCase().includes(s) ||
        (r.position?.name ?? "").toLowerCase().includes(s),
    );
  }
  return rows;
}

export async function listEvaluations() {
  const db = await readDb();
  const clauseMap = new Map(db.policy_clauses.map((c) => [c.id, c]));
  const policyMap = new Map(db.policies.map((p) => [p.id, p]));
  const positionMap = new Map(db.job_positions.map((p) => [p.id, p]));
  return db.compliance_evaluations
    .map((e) => {
      const clause = clauseMap.get(e.policy_clause_id);
      return {
        evaluation: e,
        clause,
        policy: clause ? policyMap.get(clause.policy_id) : undefined,
        position: positionMap.get(e.job_position_id),
      };
    })
    .sort(
      (a, b) =>
        new Date(b.evaluation.evaluated_at).getTime() -
        new Date(a.evaluation.evaluated_at).getTime(),
    );
}

/** Үнэлсэн журмууд — дундаж оноогоор бага → их */
export async function listEvaluatedPoliciesByScoreAsc() {
  const db = await readDb();
  const clauseMap = new Map(db.policy_clauses.map((c) => [c.id, c]));
  const policyMap = new Map(db.policies.map((p) => [p.id, p]));
  const latest = latestEvaluations(
    evaluationsWithActiveLinks(
      db.compliance_evaluations,
      db.clause_position_responsibilities,
    ),
  );

  const byPolicy = new Map<
    string,
    { scores: number[]; lastAt: string; clauseIds: Set<string> }
  >();

  for (const e of latest) {
    const clause = clauseMap.get(e.policy_clause_id);
    if (!clause) continue;
    const policy = policyMap.get(clause.policy_id);
    if (!policy || policy.is_deleted) continue;
    const row = byPolicy.get(policy.id) ?? {
      scores: [],
      lastAt: e.evaluated_at,
      clauseIds: new Set<string>(),
    };
    row.scores.push(e.score);
    row.clauseIds.add(clause.id);
    if (new Date(e.evaluated_at).getTime() > new Date(row.lastAt).getTime()) {
      row.lastAt = e.evaluated_at;
    }
    byPolicy.set(policy.id, row);
  }

  return [...byPolicy.entries()]
    .map(([policyId, row]) => {
      const policy = policyMap.get(policyId)!;
      return {
        policy,
        avgScore: avg(row.scores) ?? 0,
        evaluationCount: row.scores.length,
        clauseCount: row.clauseIds.size,
        lastEvaluatedAt: row.lastAt,
      };
    })
    .sort((a, b) => a.avgScore - b.avgScore || a.policy.name.localeCompare(b.policy.name, "mn"));
}

/** Ажилчдын (ажлын байрны) үнэлгээний жагсаалт — дундаж оноогоор бага → их */
export async function listPositionEvaluationSummaries() {
  const db = await readDb();
  const positionMap = new Map(db.job_positions.map((p) => [p.id, p]));
  const latest = latestEvaluations(
    evaluationsWithActiveLinks(
      db.compliance_evaluations,
      db.clause_position_responsibilities,
    ),
  );

  const byPosition = new Map<
    string,
    { scores: number[]; lastAt: string; policyIds: Set<string> }
  >();
  const clauseMap = new Map(db.policy_clauses.map((c) => [c.id, c]));

  for (const e of latest) {
    if (!positionMap.has(e.job_position_id)) continue;
    const clause = clauseMap.get(e.policy_clause_id);
    const row = byPosition.get(e.job_position_id) ?? {
      scores: [],
      lastAt: e.evaluated_at,
      policyIds: new Set<string>(),
    };
    row.scores.push(e.score);
    if (clause) row.policyIds.add(clause.policy_id);
    if (new Date(e.evaluated_at).getTime() > new Date(row.lastAt).getTime()) {
      row.lastAt = e.evaluated_at;
    }
    byPosition.set(e.job_position_id, row);
  }

  return [...byPosition.entries()]
    .map(([positionId, row]) => {
      const position = positionMap.get(positionId)!;
      return {
        position,
        unitLabel:
          [position.heltes_name, position.alba_name].filter(Boolean).join(" · ") ||
          "Ангилагдаагүй",
        avgScore: avg(row.scores) ?? 0,
        evaluationCount: row.scores.length,
        policyCount: row.policyIds.size,
        lastEvaluatedAt: row.lastAt,
      };
    })
    .sort(
      (a, b) =>
        a.avgScore - b.avgScore ||
        (a.position.name ?? "").localeCompare(b.position.name ?? "", "mn"),
    );
}

export async function createEvaluation(input: {
  policy_clause_id: string;
  job_position_id: string;
  responsibility_type: ResponsibilityType;
  evaluation_period: string;
  period_start?: string | null;
  period_end?: string | null;
  score: number;
  status: ComplianceEvaluation["status"];
  comment?: string | null;
  evidence_text?: string | null;
}) {
  return updateDb((db) => {
    const now = new Date().toISOString();
    // Ensure matching responsibility link exists and is active
    const existingLink = db.clause_position_responsibilities.find(
      (l) =>
        l.policy_clause_id === input.policy_clause_id &&
        l.job_position_id === input.job_position_id &&
        l.responsibility_type === input.responsibility_type,
    );
    if (existingLink) {
      existingLink.is_active = true;
    } else {
      db.clause_position_responsibilities.push({
        id: newId(),
        policy_clause_id: input.policy_clause_id,
        job_position_id: input.job_position_id,
        responsibility_type: input.responsibility_type,
        is_checked: true,
        is_active: true,
        weight: 1,
        required_evidence: null,
        notes: "Үнэлгээний үед автоматаар үүсгэсэн",
      });
    }

    const evaluation: ComplianceEvaluation = {
      id: newId(),
      policy_clause_id: input.policy_clause_id,
      job_position_id: input.job_position_id,
      responsibility_type: input.responsibility_type,
      evaluation_period: input.evaluation_period,
      period_start: input.period_start ?? null,
      period_end: input.period_end ?? null,
      evaluator_user_id: db.users[0]?.id ?? null,
      score: input.score,
      status: input.status,
      comment: input.comment ?? null,
      evaluated_at: now,
      created_at: now,
      updated_at: now,
    };
    db.compliance_evaluations.push(evaluation);
    if (input.evidence_text?.trim()) {
      const evidence: EvaluationEvidence = {
        id: newId(),
        evaluation_id: evaluation.id,
        evidence_type: "text",
        title: "Үнэлгээний нотлох баримт",
        content: input.evidence_text,
        url: null,
        file_path: null,
        metadata: {},
        created_at: now,
      };
      db.evaluation_evidence.push(evidence);
    }
  });
}

export async function createPolicy(input: {
  name: string;
  reference_code?: string | null;
  approved_date?: string | null;
  status?: Policy["status"];
}) {
  let created: Policy | null = null;
  await updateDb((db) => {
    const now = new Date().toISOString();
    created = {
      id: newId(),
      name: input.name,
      reference_code: input.reference_code ?? null,
      approved_date: input.approved_date ?? null,
      status: input.status ?? "draft",
      version: 1,
      is_deleted: false,
      created_at: now,
      updated_at: now,
    };
    db.policies.push(created);
  });
  return created!;
}

export async function updatePolicy(
  id: string,
  input: {
    name?: string;
    reference_code?: string | null;
    approved_date?: string | null;
    status?: Policy["status"];
  },
) {
  let updated: Policy | null = null;
  await updateDb((db) => {
    const p = db.policies.find((x) => x.id === id && !x.is_deleted);
    if (!p) return;
    if (input.name !== undefined) p.name = input.name.trim();
    if (input.reference_code !== undefined) {
      p.reference_code = input.reference_code?.trim() || null;
    }
    if (input.approved_date !== undefined) {
      p.approved_date = input.approved_date || null;
    }
    if (input.status !== undefined) p.status = input.status;
    p.updated_at = new Date().toISOString();
    updated = p;
  });
  return updated;
}

export async function deletePolicy(id: string) {
  let found = false;
  await updateDb((db) => {
    const p = db.policies.find((x) => x.id === id && !x.is_deleted);
    if (!p) return;
    p.is_deleted = true;
    p.updated_at = new Date().toISOString();
    for (const s of db.policy_sections) {
      if (s.policy_id === id) s.is_deleted = true;
    }
    for (const c of db.policy_clauses) {
      if (c.policy_id === id) c.is_deleted = true;
    }
    const clauseIds = new Set(
      db.policy_clauses.filter((c) => c.policy_id === id).map((c) => c.id),
    );
    for (const link of db.clause_position_responsibilities) {
      if (clauseIds.has(link.policy_clause_id)) {
        link.is_active = false;
        link.is_checked = false;
      }
    }
    found = true;
  });
  return found;
}

export async function updateClause(
  id: string,
  input: {
    text?: string;
    reference_number?: string | null;
  },
) {
  let updated: PolicyClause | null = null;
  await updateDb((db) => {
    const c = db.policy_clauses.find((x) => x.id === id && !x.is_deleted);
    if (!c) return;
    if (input.text !== undefined) c.text = input.text.trim();
    if (input.reference_number !== undefined) {
      c.reference_number = input.reference_number?.trim() || null;
    }
    updated = c;
  });
  return updated;
}

export async function deleteClause(id: string) {
  let found = false;
  await updateDb((db) => {
    const c = db.policy_clauses.find((x) => x.id === id);
    if (!c) return;
    c.is_deleted = true;
    for (const link of db.clause_position_responsibilities) {
      if (link.policy_clause_id === id) {
        link.is_active = false;
        link.is_checked = false;
      }
    }
    found = true;
  });
  return found;
}

export async function addClause(input: {
  policy_id: string;
  section_id?: string | null;
  parent_id?: string | null;
  reference_number?: string | null;
  text: string;
}) {
  let created: PolicyClause | null = null;
  await updateDb((db) => {
    const siblings = db.policy_clauses.filter(
      (c) =>
        c.policy_id === input.policy_id &&
        (c.parent_id ?? null) === (input.parent_id ?? null) &&
        (c.section_id ?? null) === (input.section_id ?? null),
    );
    created = {
      id: newId(),
      policy_id: input.policy_id,
      section_id: input.section_id ?? null,
      parent_id: input.parent_id ?? null,
      reference_number: input.reference_number ?? null,
      text: input.text,
      sort_order: siblings.length,
      is_deleted: false,
    };
    db.policy_clauses.push(created);
  });
  return created!;
}

export async function addSection(input: {
  policy_id: string;
  text?: string | null;
  reference_number?: string | null;
}) {
  let created: PolicySection | null = null;
  await updateDb((db) => {
    const siblings = db.policy_sections.filter((s) => s.policy_id === input.policy_id);
    created = {
      id: newId(),
      policy_id: input.policy_id,
      text: input.text ?? null,
      reference_number: input.reference_number ?? null,
      sort_order: siblings.length,
      is_deleted: false,
    };
    db.policy_sections.push(created);
  });
  return created!;
}

export async function updateSection(
  id: string,
  input: {
    text?: string;
    reference_number?: string | null;
  },
) {
  let updated: PolicySection | null = null;
  await updateDb((db) => {
    const s = db.policy_sections.find((x) => x.id === id && !x.is_deleted);
    if (!s) return;
    if (input.text !== undefined) s.text = input.text.trim();
    if (input.reference_number !== undefined) {
      s.reference_number = input.reference_number?.trim() || null;
    }
    updated = s;
  });
  return updated;
}

/** Soft-delete section; orphan clauses keep section_id but disappear from trees. */
export async function deleteSection(id: string) {
  let found = false;
  await updateDb((db) => {
    const s = db.policy_sections.find((x) => x.id === id);
    if (!s || s.is_deleted) return;
    s.is_deleted = true;
    for (const c of db.policy_clauses) {
      if (c.section_id === id) {
        c.section_id = null;
      }
    }
    found = true;
  });
  return found;
}

export async function upsertResponsibility(input: {
  policy_clause_id: string;
  job_position_id: string;
  responsibility_type: ResponsibilityType;
  weight?: number;
  required_evidence?: string | null;
  notes?: string | null;
}) {
  await updateDb((db) => {
    const existing = db.clause_position_responsibilities.find(
      (r) =>
        r.policy_clause_id === input.policy_clause_id &&
        r.job_position_id === input.job_position_id &&
        r.responsibility_type === input.responsibility_type,
    );
    if (existing) {
      existing.is_active = true;
      existing.is_checked = true;
      existing.weight = input.weight ?? existing.weight;
      existing.required_evidence = input.required_evidence ?? existing.required_evidence;
      existing.notes = input.notes ?? existing.notes;
      return;
    }
    db.clause_position_responsibilities.push({
      id: newId(),
      policy_clause_id: input.policy_clause_id,
      job_position_id: input.job_position_id,
      responsibility_type: input.responsibility_type,
      is_checked: true,
      is_active: true,
      weight: input.weight ?? 1,
      required_evidence: input.required_evidence ?? null,
      notes: input.notes ?? null,
    });
  });
}

/** Soft-unlink: deactivate responsibility so it disappears from clause/position UIs. */
export async function deactivateResponsibility(linkId: string) {
  let found = false;
  await updateDb((db) => {
    const link = db.clause_position_responsibilities.find((r) => r.id === linkId);
    if (!link) return;
    link.is_active = false;
    link.is_checked = false;
    found = true;
  });
  return found;
}

function normalizeOfficialCode(value: string | null | undefined) {
  const trimmed = (value ?? "").trim();
  return trimmed || null;
}

function positionOfficialCode(
  position: JobPosition,
  aCode?: string | null,
): string | null {
  return (
    normalizeOfficialCode(position.official_code) ??
    normalizeOfficialCode(aCode)
  );
}

/** Copy active clause links from other jobs that share the same official code. */
export async function copyResponsibilitiesByOfficialCode(
  positionId: string,
  officialCode: string | null | undefined,
) {
  const needle = normalizeOfficialCode(officialCode);
  if (!needle) return 0;
  let copied = 0;
  await updateDb((db) => {
    const aCodeByPosition = new Map(
      db.job_descriptions.map((d) => [d.job_position_id, d.a_code]),
    );
    const sourceIds = new Set(
      db.job_positions
        .filter((p) => p.is_active && p.id !== positionId)
        .filter(
          (p) =>
            positionOfficialCode(p, aCodeByPosition.get(p.id)) === needle,
        )
        .map((p) => p.id),
    );
    if (!sourceIds.size) return;

    const seen = new Set(
      db.clause_position_responsibilities
        .filter((r) => r.job_position_id === positionId)
        .map((r) => `${r.policy_clause_id}:${r.responsibility_type}`),
    );
    for (const link of db.clause_position_responsibilities) {
      if (!link.is_active || !sourceIds.has(link.job_position_id)) continue;
      const key = `${link.policy_clause_id}:${link.responsibility_type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      db.clause_position_responsibilities.push({
        id: newId(),
        policy_clause_id: link.policy_clause_id,
        job_position_id: positionId,
        responsibility_type: link.responsibility_type,
        is_checked: true,
        is_active: true,
        weight: link.weight,
        required_evidence: link.required_evidence,
        notes: link.notes,
      });
      copied += 1;
    }
  });
  return copied;
}

export async function updatePositionOfficialCode(
  id: string,
  officialCode: string | null,
) {
  let found = false;
  await updateDb((db) => {
    const position = db.job_positions.find((p) => p.id === id);
    if (!position) return;
    position.official_code = normalizeOfficialCode(officialCode);
    position.updated_at = new Date().toISOString();
    found = true;
  });
  return found;
}

export async function createPosition(input: {
  name: string;
  bteg_id?: string | null;
  official_code?: string | null;
  organization_id?: string | null;
  organization_name?: string | null;
  gazar_id?: string | null;
  heltes_id?: string | null;
  alba_id?: string | null;
  heltes_name?: string | null;
  alba_name?: string | null;
  description?: string | null;
}) {
  let created: JobPosition | null = null;
  await updateDb((db) => {
    const now = new Date().toISOString();
    created = {
      id: newId(),
      name: input.name,
      bteg_id: input.bteg_id ?? null,
      official_code: normalizeOfficialCode(input.official_code),
      organization_id: input.organization_id ?? null,
      organization_name: input.organization_name?.trim() || null,
      gazar_id: input.gazar_id ?? null,
      heltes_id: input.heltes_id ?? null,
      alba_id: input.alba_id ?? null,
      heltes_name: input.heltes_name ?? null,
      alba_name: input.alba_name ?? null,
      org_unit_id: null,
      description: input.description ?? null,
      is_active: true,
      created_at: now,
      updated_at: now,
    };
    db.job_positions.push(created);
  });
  return created!;
}

/** Soft-delete: hide position and deactivate its responsibility links. */
export async function deletePosition(id: string) {
  let found = false;
  await updateDb((db) => {
    const p = db.job_positions.find((x) => x.id === id);
    if (!p) return;
    p.is_active = false;
    p.updated_at = new Date().toISOString();
    for (const link of db.clause_position_responsibilities) {
      if (link.job_position_id === id) {
        link.is_active = false;
        link.is_checked = false;
      }
    }
    found = true;
  });
  return found;
}

export async function upsertJobDescription(
  input: Partial<JobDescription> & { job_position_id: string },
) {
  await updateDb((db) => {
    const existing = db.job_descriptions.find(
      (d) => d.job_position_id === input.job_position_id,
    );
    if (existing) {
      // Preserve markdown_body / raw / supervisor links unless explicitly provided.
      if (input.title !== undefined) existing.title = input.title;
      if (input.a_code !== undefined) existing.a_code = input.a_code;
      if (input.job_condition !== undefined) {
        existing.job_condition = input.job_condition;
      }
      if (input.purpose !== undefined) existing.purpose = input.purpose;
      if (input.schedule !== undefined) existing.schedule = input.schedule;
      if (input.daily_hours !== undefined) existing.daily_hours = input.daily_hours;
      if (input.break_time !== undefined) existing.break_time = input.break_time;
      if (input.duties !== undefined) existing.duties = input.duties;
      if (input.education_level !== undefined) {
        existing.education_level = input.education_level;
      }
      if (input.work_experience !== undefined) {
        existing.work_experience = input.work_experience;
      }
      if (input.general_skills !== undefined) {
        existing.general_skills = input.general_skills;
      }
      if (input.professional_skills !== undefined) {
        existing.professional_skills = input.professional_skills;
      }
      if (input.authority !== undefined) existing.authority = input.authority;
      if (input.responsibilities !== undefined) {
        existing.responsibilities = input.responsibilities;
      }
      if (input.relevant_laws !== undefined) {
        existing.relevant_laws = input.relevant_laws;
      }
      if (input.resources !== undefined) existing.resources = input.resources;
      if (input.communication_scope !== undefined) {
        existing.communication_scope = input.communication_scope;
      }
      if (input.markdown_body !== undefined) {
        existing.markdown_body = input.markdown_body;
      }
      return;
    }
    db.job_descriptions.push({
      id: newId(),
      job_position_id: input.job_position_id,
      title: input.title ?? null,
      a_code: input.a_code ?? null,
      purpose: input.purpose ?? null,
      schedule: input.schedule ?? null,
      daily_hours: input.daily_hours ?? null,
      break_time: input.break_time ?? null,
      duties: input.duties ?? [],
      education_level: input.education_level ?? null,
      work_experience: input.work_experience ?? null,
      general_skills: input.general_skills ?? [],
      professional_skills: input.professional_skills ?? [],
      authority: input.authority ?? null,
      responsibilities: input.responsibilities ?? null,
      relevant_laws: input.relevant_laws ?? [],
      job_condition: input.job_condition ?? null,
      resources: input.resources ?? null,
      communication_scope: input.communication_scope ?? null,
      supervisor_positions: input.supervisor_positions ?? [],
      subordinate_positions: input.subordinate_positions ?? [],
      markdown_body: input.markdown_body ?? null,
    });
  });
}

export async function getDataQualityWarnings(): Promise<DataQualityWarning[]> {
  const db = await readDb();
  const warnings: DataQualityWarning[] = [];

  const linkedClauseIds = new Set(
    db.clause_position_responsibilities.filter((r) => r.is_active).map((r) => r.policy_clause_id),
  );
  const clausesNoLink = db.policy_clauses.filter(
    (c) => !c.is_deleted && !linkedClauseIds.has(c.id),
  );
  if (clausesNoLink.length) {
    warnings.push({
      code: "clause_without_position",
      message: "Албан тушаалтай холбогдоогүй зүйл заалт",
      entity_type: "policy_clause",
      count: clausesNoLink.length,
    });
  }

  const obligatedPositions = new Set(
    db.clause_position_responsibilities.filter((r) => r.is_active).map((r) => r.job_position_id),
  );
  const positionsNoObligation = db.job_positions.filter(
    (p) => p.is_active && !obligatedPositions.has(p.id),
  );
  if (positionsNoObligation.length) {
    warnings.push({
      code: "position_without_obligation",
      message: "Журмын үүрэггүй ажлын байр",
      entity_type: "job_position",
      count: positionsNoObligation.length,
    });
  }

  const described = new Set(db.job_descriptions.map((d) => d.job_position_id));
  const noDesc = db.job_positions.filter((p) => p.is_active && !described.has(p.id));
  if (noDesc.length) {
    warnings.push({
      code: "position_without_jd",
      message: "Тодорхойлолтгүй ажлын байр",
      entity_type: "job_position",
      count: noDesc.length,
    });
  }

  const activePos = new Set(db.job_positions.filter((p) => p.is_active).map((p) => p.id));
  const dangling = db.clause_position_responsibilities.filter(
    (r) => r.is_active && !activePos.has(r.job_position_id),
  );
  if (dangling.length) {
    warnings.push({
      code: "link_without_active_position",
      message: "Идэвхгүй ажлын байртай хариуцлагын холбоос",
      entity_type: "clause_position_responsibility",
      count: dangling.length,
    });
  }

  const evalsWithEvidence = new Set(db.evaluation_evidence.map((e) => e.evaluation_id));
  const noEvidence = db.compliance_evaluations.filter((e) => !evalsWithEvidence.has(e.id));
  if (noEvidence.length) {
    warnings.push({
      code: "evaluation_without_evidence",
      message: "Нотлох баримтгүй үнэлгээ",
      entity_type: "compliance_evaluation",
      count: noEvidence.length,
    });
  }

  const nameCounts = new Map<string, number>();
  for (const p of db.job_positions) {
    nameCounts.set(p.name, (nameCounts.get(p.name) ?? 0) + 1);
  }
  const dupNames = [...nameCounts.entries()].filter(([, n]) => n > 1);
  if (dupNames.length) {
    warnings.push({
      code: "duplicate_position_names",
      message: "Давхардсан ажлын байрны нэр",
      entity_type: "job_position",
      count: dupNames.length,
    });
  }

  return warnings;
}

export async function exportMatrixCsv(): Promise<string> {
  const rows = await getMatrixRows();
  const header = [
    "policy_id",
    "policy_name",
    "clause_id",
    "reference_number",
    "job_position_id",
    "job_position_name",
    "responsibility_type",
    "score",
    "status",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.policy?.id ?? "",
        csvEscape(r.policy?.name ?? ""),
        r.clause?.id ?? "",
        csvEscape(r.clause?.reference_number ?? ""),
        r.position?.id ?? "",
        csvEscape(r.position?.name ?? ""),
        r.link.responsibility_type,
        r.evaluation?.score ?? "",
        r.evaluation?.status ?? "",
      ].join(","),
    );
  }
  return lines.join("\n");
}

export async function exportEvaluationsCsv(): Promise<string> {
  const rows = await listEvaluations();
  const header = [
    "evaluation_id",
    "period",
    "policy_name",
    "clause_ref",
    "position_name",
    "responsibility_type",
    "score",
    "status",
    "evaluated_at",
  ];
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.evaluation.id,
        csvEscape(r.evaluation.evaluation_period),
        csvEscape(r.policy?.name ?? ""),
        csvEscape(r.clause?.reference_number ?? ""),
        csvEscape(r.position?.name ?? ""),
        r.evaluation.responsibility_type,
        r.evaluation.score,
        r.evaluation.status,
        r.evaluation.evaluated_at,
      ].join(","),
    );
  }
  return lines.join("\n");
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export type { LocalDatabase };
