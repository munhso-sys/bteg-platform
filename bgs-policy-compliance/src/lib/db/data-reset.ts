import { readDb, updateDb } from "@/lib/db/local-store";
import {
  clearAllPolicyOrgOverrides,
  clearAllPositionOrgOverrides,
  countPolicyOrgOverrides,
  countPositionOrgOverrides,
  loadPolicyOrgOverridesForExport,
  loadPositionOrgOverridesForExport,
} from "@/lib/db/org";

export type PolicyClearSection =
  | "evaluations"
  | "responsibilities"
  | "policies"
  | "orgMaster"
  | "orgAllocations";

export type PolicyClearResult = {
  cleared: PolicyClearSection[];
  counts: Partial<Record<PolicyClearSection, number>>;
};

export async function countPolicyStoreSections() {
  const db = await readDb();
  const [policyOv, positionOv] = await Promise.all([
    countPolicyOrgOverrides(),
    countPositionOrgOverrides(),
  ]);
  return {
    evaluations:
      db.compliance_evaluations.length + db.evaluation_evidence.length,
    responsibilities: db.clause_position_responsibilities.length,
    policies:
      db.policies.length +
      db.policy_sections.length +
      db.policy_clauses.length +
      db.policy_scope_targets.length,
    orgMaster:
      db.org_units.length +
      db.job_positions.length +
      db.job_descriptions.length,
    orgAllocations: policyOv + positionOv,
  };
}

/** JSON backup of selected operational sections. */
export async function exportPolicyStoreSections(
  sections: PolicyClearSection[],
) {
  const selected = new Set(sections);
  const db = await readDb();
  const payload: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    app: "policy-compliance",
    sections: [...selected],
  };

  if (selected.has("evaluations")) {
    payload.evaluations = {
      compliance_evaluations: db.compliance_evaluations,
      evaluation_evidence: db.evaluation_evidence,
    };
  }
  if (selected.has("responsibilities")) {
    payload.responsibilities = db.clause_position_responsibilities;
  }
  if (selected.has("policies")) {
    payload.policies = {
      policies: db.policies,
      policy_sections: db.policy_sections,
      policy_clauses: db.policy_clauses,
      policy_scope_targets: db.policy_scope_targets,
    };
  }
  if (selected.has("orgMaster")) {
    payload.orgMaster = {
      org_units: db.org_units,
      job_positions: db.job_positions,
      job_descriptions: db.job_descriptions,
    };
  }
  if (selected.has("orgAllocations")) {
    payload.orgAllocations = {
      policyOrgOverrides: await loadPolicyOrgOverridesForExport(),
      positionOrgOverrides: await loadPositionOrgOverridesForExport(),
    };
  }

  return payload;
}

/**
 * Selectively wipe operational data. Keeps users; never touches bundled
 * seed files except via normal writeDb/override saves.
 */
export async function clearPolicyStoreSections(
  sections: PolicyClearSection[],
): Promise<PolicyClearResult> {
  const selected = new Set(sections);
  const counts: PolicyClearResult["counts"] = {};
  const cleared: PolicyClearSection[] = [];
  const before = await countPolicyStoreSections();

  if (
    selected.has("evaluations") ||
    selected.has("responsibilities") ||
    selected.has("policies") ||
    selected.has("orgMaster")
  ) {
    await updateDb((db) => {
      if (selected.has("evaluations")) {
        counts.evaluations =
          db.compliance_evaluations.length + db.evaluation_evidence.length;
        db.compliance_evaluations = [];
        db.evaluation_evidence = [];
      }
      if (selected.has("responsibilities")) {
        counts.responsibilities = db.clause_position_responsibilities.length;
        db.clause_position_responsibilities = [];
      }
      if (selected.has("policies")) {
        counts.policies =
          db.policies.length +
          db.policy_sections.length +
          db.policy_clauses.length +
          db.policy_scope_targets.length;
        db.policies = [];
        db.policy_sections = [];
        db.policy_clauses = [];
        db.policy_scope_targets = [];
      }
      if (selected.has("orgMaster")) {
        counts.orgMaster =
          db.org_units.length +
          db.job_positions.length +
          db.job_descriptions.length;
        db.org_units = [];
        db.job_positions = [];
        db.job_descriptions = [];
      }
    });
    if (selected.has("evaluations")) cleared.push("evaluations");
    if (selected.has("responsibilities")) cleared.push("responsibilities");
    if (selected.has("policies")) cleared.push("policies");
    if (selected.has("orgMaster")) cleared.push("orgMaster");
  }

  if (selected.has("orgAllocations")) {
    counts.orgAllocations = before.orgAllocations;
    await clearAllPolicyOrgOverrides();
    await clearAllPositionOrgOverrides();
    cleared.push("orgAllocations");
  }

  return { cleared, counts };
}
