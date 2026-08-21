/**
 * Integration contract with bgs-policy-compliance.
 * Inspection Center owns findings/evidence; policy compliance consumes links.
 */

export type PolicySeverity = "low" | "medium" | "high" | "critical";
export type PolicyFindingStatus =
  | "open"
  | "in_progress"
  | "resolved"
  | "closed";

export type InspectionFindingLinkedToPolicyClause = {
  findingId: string;
  inspectionRunId: string;
  policyClauseId: string;
  targetOrgUnitId?: string;
  targetJobPositionId?: string;
  severity: PolicySeverity;
  status: PolicyFindingStatus;
};

export type InspectionEvidenceForCompliance = {
  evidenceId: string;
  inspectionRunId: string;
  findingId?: string;
  policyClauseId?: string;
  fileUrl: string;
  fileType: string;
  caption: string;
  uploadedAt: string;
};

export type CorrectiveActionLinkedToObligation = {
  actionId: string;
  findingId: string;
  policyClauseId?: string;
  obligationId?: string;
  progressPercent: number;
  status: string;
  dueDate?: string;
};

export type InspectionScoreFeed = {
  inspectionRunId: string;
  templateCode?: string;
  targetOrgUnitId?: string;
  targetDepartmentId?: string;
  compliancePercent: number;
  riskPercent: number;
  riskLevel: string;
  calculatedAt: string;
};

export function toPolicyFindingLink(input: {
  findingId: string;
  runId: string;
  policyClauseId: string;
  targetOrgUnitId?: string | null;
  targetJobPositionId?: string | null;
  severity: PolicySeverity;
  status: PolicyFindingStatus;
}): InspectionFindingLinkedToPolicyClause {
  return {
    findingId: input.findingId,
    inspectionRunId: input.runId,
    policyClauseId: input.policyClauseId,
    targetOrgUnitId: input.targetOrgUnitId ?? undefined,
    targetJobPositionId: input.targetJobPositionId ?? undefined,
    severity: input.severity,
    status: input.status,
  };
}
