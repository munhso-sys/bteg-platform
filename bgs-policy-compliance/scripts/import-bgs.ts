#!/usr/bin/env tsx
/**
 * Import BGS export JSON into local data/local/db.json
 *
 * Usage:
 *   npx tsx scripts/import-bgs.ts [path-to-export-root]
 *
 * Default export root:
 *   C:\Users\Owner\Desktop\260710\Research\BGS_job_descriptions_policies_export_2026-07-19
 */

import { promises as fs } from "fs";
import path from "path";
import { pathToFileURL } from "url";

import type {
  ClausePositionResponsibility,
  ImportReport,
  JobDescription,
  JobPosition,
  LocalDatabase,
  OrgUnit,
  OrgUnitType,
  Policy,
  PolicyClause,
  PolicyScopeTarget,
  PolicySection,
  ResponsibilityType,
} from "../src/lib/types";

const DEFAULT_SOURCE =
  "C:\\Users\\Owner\\Desktop\\260710\\Research\\BGS_job_descriptions_policies_export_2026-07-19";

type RawClause = {
  id: string;
  text?: string;
  referenceNumber?: string | null;
  sectionId?: string | null;
  parentId?: string | null;
  policyId?: string;
  isDeleted?: boolean;
  children?: RawClause[];
  clause_position?: Array<{
    id: string;
    clause_id?: string;
    job_position_id: string;
    type: string;
    is_checked?: boolean;
  }>;
};

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

function asResponsibilityType(value: string): ResponsibilityType | null {
  const v = value.toUpperCase();
  if (
    v === "IMPLEMENTATION" ||
    v === "MONITORING" ||
    v === "VERIFICATION" ||
    v === "DEPLOYMENT"
  ) {
    return v;
  }
  return null;
}

function mapUnitType(targetType: string): OrgUnitType {
  switch (targetType) {
    case "organization":
      return "organization";
    case "gazar":
      return "gazar";
    case "heltes":
      return "heltes";
    case "alba":
      return "alba";
    default:
      return "other";
  }
}

function emptyDb(): LocalDatabase {
  return {
    meta: { imported_at: null, source_path: null, import_report: null },
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
    policy_scope_targets: [],
    clause_position_responsibilities: [],
    compliance_evaluations: [],
    evaluation_evidence: [],
  };
}

function walkClauses(
  raw: RawClause,
  policyId: string,
  sectionId: string | null,
  sink: {
    clauses: PolicyClause[];
    links: ClausePositionResponsibility[];
    missingPositions: Set<string>;
    positionIds: Set<string>;
    warnings: string[];
  },
  sortOrder: number,
) {
  const clause: PolicyClause = {
    id: raw.id,
    policy_id: policyId,
    section_id: raw.sectionId ?? sectionId,
    parent_id: raw.parentId ?? null,
    reference_number: raw.referenceNumber ?? null,
    text: raw.text ?? "",
    sort_order: sortOrder,
    is_deleted: Boolean(raw.isDeleted),
  };
  sink.clauses.push(clause);

  for (const cp of raw.clause_position ?? []) {
    const type = asResponsibilityType(cp.type);
    if (!type) {
      sink.warnings.push(`Unknown responsibility type ${cp.type} on clause ${raw.id}`);
      continue;
    }
    if (!sink.positionIds.has(cp.job_position_id)) {
      sink.missingPositions.add(cp.job_position_id);
    }
    sink.links.push({
      id: cp.id,
      policy_clause_id: raw.id,
      job_position_id: cp.job_position_id,
      responsibility_type: type,
      is_checked: cp.is_checked ?? true,
      is_active: true,
      weight: 1,
      required_evidence: null,
      notes: null,
    });
  }

  (raw.children ?? []).forEach((child, idx) => {
    // Ensure parent linkage if export omitted it
    if (!child.parentId) child.parentId = raw.id;
    if (!child.sectionId) child.sectionId = clause.section_id;
    if (!child.policyId) child.policyId = policyId;
    walkClauses(child, policyId, clause.section_id, sink, idx);
  });
}

async function importFromSource(sourceRoot: string): Promise<{ db: LocalDatabase; report: ImportReport }> {
  const rawDir = path.join(sourceRoot, "01_RAW_JSON");
  const [
    policyList,
    positionsRaw,
    descriptionsRaw,
    scopeRaw,
    fullDetails,
  ] = await Promise.all([
    readJson<Array<Record<string, unknown>>>(path.join(rawDir, "policy.json")),
    readJson<Array<Record<string, unknown>>>(path.join(rawDir, "job_position.json")),
    readJson<Array<Record<string, unknown>>>(path.join(rawDir, "job_description.json")),
    readJson<Array<Record<string, unknown>>>(path.join(rawDir, "policy_scope_targets.json")),
    readJson<Array<Record<string, unknown>>>(path.join(rawDir, "policy_full_details.json")),
  ]);

  // Optional CSV of links (if present)
  const csvPath = path.join(sourceRoot, "out", "bgs_clause_position_links.csv");
  const csvLinks: ClausePositionResponsibility[] = [];
  try {
    const csv = await fs.readFile(csvPath, "utf8");
    const lines = csv.split(/\r?\n/).filter(Boolean);
    const header = lines.shift()?.split(",") ?? [];
    const idx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));
    for (const line of lines) {
      const cols = line.split(",");
      const type = asResponsibilityType(cols[idx.responsibility_type ?? idx.type] ?? "");
      if (!type) continue;
      csvLinks.push({
        id: cols[idx.id] || crypto.randomUUID(),
        policy_clause_id: cols[idx.policy_clause_id ?? idx.clause_id],
        job_position_id: cols[idx.job_position_id],
        responsibility_type: type,
        is_checked: (cols[idx.is_checked] ?? "true") !== "false",
        is_active: true,
        weight: 1,
        required_evidence: null,
        notes: "imported_from_csv",
      });
    }
  } catch {
    // CSV optional — links primarily come from policy_full_details
  }

  const db = emptyDb();
  const warnings: string[] = [];
  const missingPositions = new Set<string>();

  const orgMap = new Map<string, OrgUnit>();

  function upsertOrgUnit(input: {
    unit_type: OrgUnitType;
    bteg_id: string | null;
    name: string;
    parent_bteg_id?: string | null;
  }) {
    if (!input.bteg_id && !input.name) return;
    const key = `${input.unit_type}:${input.bteg_id ?? input.name}`;
    const existing = orgMap.get(key);
    if (existing) {
      if ((!existing.name || existing.name === existing.bteg_id) && input.name) {
        existing.name = input.name;
      }
      if (!existing.parent_bteg_id && input.parent_bteg_id) {
        existing.parent_bteg_id = input.parent_bteg_id;
      }
      return existing;
    }
    const unit: OrgUnit = {
      id: crypto.randomUUID(),
      bteg_id: input.bteg_id,
      name: input.name,
      unit_type: input.unit_type,
      parent_id: null,
      parent_bteg_id: input.parent_bteg_id ?? null,
      is_active: true,
    };
    orgMap.set(key, unit);
    return unit;
  }

  // Build org units from nested heltes/alba on positions (authoritative names)
  for (const p of positionsRaw) {
    const heltesObj = p.heltes as Record<string, unknown> | null | undefined;
    const albaObj = p.alba as Record<string, unknown> | null | undefined;
    const heltesId =
      p.heltes_id != null
        ? String(p.heltes_id)
        : heltesObj?.bteg_id != null
          ? String(heltesObj.bteg_id)
          : null;
    const albaId =
      p.alba_id != null
        ? String(p.alba_id)
        : albaObj?.bteg_id != null
          ? String(albaObj.bteg_id)
          : null;

    if (heltesId || heltesObj) {
      upsertOrgUnit({
        unit_type: "heltes",
        bteg_id: heltesId,
        name: heltesObj?.name != null ? String(heltesObj.name) : `Хэлтэс ${heltesId}`,
      });
    }
    if (albaId || albaObj) {
      const parentHeltes =
        heltesId ||
        (albaObj?.heltes_id != null ? String(albaObj.heltes_id) : null) ||
        null;
      upsertOrgUnit({
        unit_type: "alba",
        bteg_id: albaId,
        name: albaObj?.name != null ? String(albaObj.name) : `Алба ${albaId}`,
        parent_bteg_id: parentHeltes,
      });
    }
  }

  for (const s of scopeRaw) {
    const bteg = s.target_bteg_id != null ? String(s.target_bteg_id) : null;
    const unitType = mapUnitType(String(s.target_type ?? "other"));
    upsertOrgUnit({
      unit_type: unitType,
      bteg_id: bteg,
      name: String(s.target_name ?? bteg ?? "Unknown"),
      parent_bteg_id: s.parent_bteg_id != null ? String(s.parent_bteg_id) : null,
    });
  }

  // Resolve parent_id for albas → heltes
  for (const unit of orgMap.values()) {
    if (unit.unit_type === "alba" && unit.parent_bteg_id) {
      const parent = orgMap.get(`heltes:${unit.parent_bteg_id}`);
      if (parent) unit.parent_id = parent.id;
    }
  }
  db.org_units = [...orgMap.values()];

  const positions: JobPosition[] = positionsRaw.map((p) => {
    const heltesObj = p.heltes as Record<string, unknown> | null | undefined;
    const albaObj = p.alba as Record<string, unknown> | null | undefined;
    const heltesId = p.heltes_id != null ? String(p.heltes_id) : null;
    const albaId = p.alba_id != null ? String(p.alba_id) : null;
    const heltesName =
      heltesObj?.name != null
        ? String(heltesObj.name)
        : heltesId
          ? orgMap.get(`heltes:${heltesId}`)?.name ?? null
          : null;
    const albaName =
      albaObj?.name != null
        ? String(albaObj.name)
        : albaId
          ? orgMap.get(`alba:${albaId}`)?.name ?? null
          : null;
    return {
      id: String(p.id),
      bteg_id: p.bteg_id != null ? String(p.bteg_id) : null,
      name: String(p.name ?? ""),
      organization_id: p.organization_id != null ? String(p.organization_id) : null,
      organization_name: p.organization_name != null ? String(p.organization_name) : null,
      gazar_id: p.gazar_id != null ? String(p.gazar_id) : null,
      heltes_id: heltesId,
      alba_id: albaId,
      heltes_name: heltesName,
      alba_name: albaName,
      org_unit_id: null,
      description: p.description != null ? String(p.description) : null,
      is_active: p.is_active !== false,
      created_at: p.created_at ? String(p.created_at) : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });
  db.job_positions = positions;
  const positionIds = new Set(positions.map((p) => p.id));

  db.job_descriptions = descriptionsRaw.map((d) => ({
    id: String(d.id),
    job_position_id: String(d.job_position_id),
    title: d.title != null ? String(d.title) : null,
    a_code: d.a_code != null ? String(d.a_code) : null,
    purpose: d.purpose != null ? String(d.purpose) : null,
    schedule: d.schedule != null ? String(d.schedule) : null,
    daily_hours: d.daily_hours != null ? String(d.daily_hours) : null,
    break_time: d.break_time != null ? String(d.break_time) : null,
    duties: Array.isArray(d.duties) ? d.duties : [],
    education_level: d.education_level != null ? String(d.education_level) : null,
    work_experience: d.work_experience != null ? String(d.work_experience) : null,
    general_skills: Array.isArray(d.general_skills) ? d.general_skills : [],
    professional_skills: Array.isArray(d.professional_skills) ? d.professional_skills : [],
    authority: d.authority != null ? String(d.authority) : null,
    responsibilities: d.responsibilities != null ? String(d.responsibilities) : null,
    relevant_laws: Array.isArray(d.relevant_laws) ? d.relevant_laws : [],
    job_condition: d.job_condition != null ? String(d.job_condition) : null,
    resources: d.resources != null ? String(d.resources) : null,
    communication_scope: d.communication_scope ?? null,
    supervisor_positions: Array.isArray(d.supervisor_positions) ? d.supervisor_positions : [],
    subordinate_positions: Array.isArray(d.subordinate_positions) ? d.subordinate_positions : [],
    raw: d,
  })) as JobDescription[];

  const policyById = new Map<string, Policy>();
  for (const p of policyList) {
    const id = String(p.id);
    policyById.set(id, {
      id,
      name: String(p.name ?? ""),
      approved_date: p.approved_date ? String(p.approved_date) : null,
      reference_code: p.reference_code != null ? String(p.reference_code) : null,
      status: "active",
      version: 1,
      is_deleted: Boolean(p.is_deleted),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  const sections: PolicySection[] = [];
  const clauses: PolicyClause[] = [];
  const links: ClausePositionResponsibility[] = [];
  const sink = { clauses, links, missingPositions, positionIds, warnings };

  for (const detail of fullDetails) {
    const policyId = String(detail.id);
    const existing = policyById.get(policyId);
    const policy: Policy = existing ?? {
      id: policyId,
      name: String(detail.name ?? ""),
      approved_date: detail.approvedDate ? String(detail.approvedDate) : null,
      reference_code: detail.referenceCode != null ? String(detail.referenceCode) : null,
      status: "active",
      version: 1,
      is_deleted: Boolean(detail.isDeleted),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (detail.approvedDate) policy.approved_date = String(detail.approvedDate);
    if (detail.referenceCode != null) policy.reference_code = String(detail.referenceCode);
    policyById.set(policyId, policy);

    const sectionList = (detail.section as Array<Record<string, unknown>> | undefined) ?? [];
    sectionList.forEach((sec, sIdx) => {
      const sectionId = String(sec.id);
      sections.push({
        id: sectionId,
        policy_id: policyId,
        text: sec.text != null ? String(sec.text) : null,
        reference_number: sec.referenceNumber != null ? String(sec.referenceNumber) : null,
        sort_order: sIdx,
        is_deleted: Boolean(sec.isDeleted),
      });
      const clauseList = (sec.clause as RawClause[] | undefined) ?? [];
      clauseList.forEach((cl, cIdx) => {
        if (!cl.policyId) cl.policyId = policyId;
        if (!cl.sectionId) cl.sectionId = sectionId;
        walkClauses(cl, policyId, sectionId, sink, cIdx);
      });
    });
  }

  db.policies = [...policyById.values()];
  db.policy_sections = sections;
  db.policy_clauses = clauses;

  // Merge CSV links if any (dedupe by clause+position+type)
  const linkKey = (l: ClausePositionResponsibility) =>
    `${l.policy_clause_id}|${l.job_position_id}|${l.responsibility_type}`;
  const linkMap = new Map<string, ClausePositionResponsibility>();
  for (const l of links) linkMap.set(linkKey(l), l);
  for (const l of csvLinks) {
    if (!positionIds.has(l.job_position_id)) missingPositions.add(l.job_position_id);
    if (!linkMap.has(linkKey(l))) linkMap.set(linkKey(l), l);
  }
  db.clause_position_responsibilities = [...linkMap.values()];

  db.policy_scope_targets = scopeRaw.map((s) => {
    const unitType = mapUnitType(String(s.target_type ?? "other"));
    const bteg = s.target_bteg_id != null ? String(s.target_bteg_id) : null;
    const key = `${unitType}:${bteg ?? s.target_name}`;
    return {
      id: s.id as number | string,
      policy_id: String(s.policy_id),
      target_type: String(s.target_type),
      target_bteg_id: bteg,
      target_name: s.target_name != null ? String(s.target_name) : null,
      parent_bteg_id: s.parent_bteg_id != null ? String(s.parent_bteg_id) : null,
      org_unit_id: orgMap.get(key)?.id ?? null,
      created_at: s.created_at ? String(s.created_at) : undefined,
    } satisfies PolicyScopeTarget;
  });

  // Attach org_unit_id on positions when bteg matches
  const orgByBteg = new Map(
    db.org_units.filter((o) => o.bteg_id).map((o) => [`${o.unit_type}:${o.bteg_id}`, o.id]),
  );
  for (const p of db.job_positions) {
    if (p.alba_id && orgByBteg.has(`alba:${p.alba_id}`)) {
      p.org_unit_id = orgByBteg.get(`alba:${p.alba_id}`) ?? null;
    } else if (p.heltes_id && orgByBteg.has(`heltes:${p.heltes_id}`)) {
      p.org_unit_id = orgByBteg.get(`heltes:${p.heltes_id}`) ?? null;
    } else if (p.gazar_id && orgByBteg.has(`gazar:${p.gazar_id}`)) {
      p.org_unit_id = orgByBteg.get(`gazar:${p.gazar_id}`) ?? null;
    }
  }

  const report: ImportReport = {
    policies: db.policies.length,
    sections: db.policy_sections.length,
    clauses: db.policy_clauses.length,
    job_positions: db.job_positions.length,
    job_descriptions: db.job_descriptions.length,
    responsibility_links: db.clause_position_responsibilities.length,
    scope_targets: db.policy_scope_targets.length,
    org_units: db.org_units.length,
    missing_positions: [...missingPositions],
    warnings,
  };

  db.meta = {
    imported_at: new Date().toISOString(),
    source_path: sourceRoot,
    import_report: report,
  };

  return { db, report };
}

async function preserveUserData(db: LocalDatabase, outPath: string) {
  try {
    const prev = JSON.parse(await fs.readFile(outPath, "utf8")) as LocalDatabase;
    const clauseIds = new Set(db.policy_clauses.map((c) => c.id));
    const positionIds = new Set(db.job_positions.map((p) => p.id));

    const evals = (prev.compliance_evaluations ?? []).filter(
      (e) =>
        clauseIds.has(e.policy_clause_id) && positionIds.has(e.job_position_id),
    );
    const evalIds = new Set(evals.map((e) => e.id));
    const evidence = (prev.evaluation_evidence ?? []).filter((ev) =>
      evalIds.has(ev.evaluation_id),
    );

    db.compliance_evaluations = evals;
    db.evaluation_evidence = evidence;
    console.log(
      `Preserved ${evals.length} evaluations and ${evidence.length} evidence rows from previous db`,
    );
  } catch {
    // No previous db — fine
  }
}

async function main() {
  const sourceRoot = process.argv[2] || DEFAULT_SOURCE;
  console.log(`Importing from: ${sourceRoot}`);
  const { db, report } = await importFromSource(sourceRoot);

  const outDir = path.join(process.cwd(), "data", "local");
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "db.json");

  await preserveUserData(db, outPath);

  // Backup before overwrite
  try {
    await fs.copyFile(outPath, `${outPath}.bak`);
  } catch {
    // ignore
  }

  await fs.writeFile(outPath, JSON.stringify(db), "utf8");

  const reportPath = path.join(outDir, "import-report.json");
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log("Import complete:");
  console.log(JSON.stringify(report, null, 2));
  console.log(`Wrote ${outPath}`);
  if (report.missing_positions.length) {
    console.warn(`Missing positions referenced by links: ${report.missing_positions.length}`);
  }
}

const isDirect =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export { importFromSource };
