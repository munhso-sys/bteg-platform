type Tone = "neutral" | "ok" | "warn" | "danger" | "brand";

export const FINDING_RISK_LABELS: Record<string, string> = {
  low: "Бага",
  medium: "Дунд",
  high: "Их",
  critical: "Маш их",
};

export type CorrectiveActionRow = {
  findingId: string;
  actionId: string | null;
  findingTitle: string;
  findingDescription: string;
  findingSourceText: string;
  findingStatus: string;
  questionText: string;
  runId: string;
  runTitle: string;
  checklistTitle: string;
  sectionTitle: string;
  inspectionTypeLabel: string;
  inspectionDate: string;
  runDueDate: string;
  runCompletedDate: string;
  inspectedByOrg: string;
  performers: Array<{ name: string; position: string }>;
  targetOrgUnitId: string;
  targetDepartmentId: string;
  severity: string;
  riskLabel: string;
  riskScore: number;
  riskExplanation: string;
  actionText: string;
  responsibleEmployeeId: string;
  responsibleJobPositionId: string;
  responsibleOrgUnitId: string;
  startDate: string;
  dueDate: string;
  completedDate: string;
  progressPercent: number;
  actionStatus: string;
  managerComment: string;
  dueLabel: string;
  dueTone: Tone;
};
