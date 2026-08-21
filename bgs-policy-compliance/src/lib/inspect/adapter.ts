/**
 * Inspect system integration adapter (placeholder).
 * Do not hard-code Inspect schema until the live schema is confirmed.
 */

export interface InspectRecordAdapterInput {
  inspect_record_id: string;
  policy_clause_id?: string;
  job_position_id?: string;
  evidence?: unknown;
  observed_score?: number;
  issue_count?: number;
}

export interface InspectFindingMapping {
  inspect_finding_id: string;
  finding_summary: string;
  policy_clause_id?: string;
  responsible_position_ids?: string[];
  suggested_score_delta?: number;
}

export async function importInspectEvidenceAsEvaluation(
  _input: InspectRecordAdapterInput,
): Promise<{ ok: false; reason: string }> {
  return {
    ok: false,
    reason:
      "Inspect evidence import is stubbed. Wire to Inspect API/schema via inspect_evidence_links.",
  };
}

export async function mapInspectFindingToClause(
  _input: InspectFindingMapping,
): Promise<{ ok: false; reason: string }> {
  return {
    ok: false,
    reason:
      "Finding-to-clause mapping is stubbed. Persist via inspect_policy_clause_links when schema is known.",
  };
}

export async function getSharedDashboardBundle(): Promise<{
  policy_compliance: null;
  inspect_findings: null;
  corrective_actions: null;
  note: string;
}> {
  return {
    policy_compliance: null,
    inspect_findings: null,
    corrective_actions: null,
    note: "Shared dashboards combine local compliance with Inspect findings once adapter is connected.",
  };
}
