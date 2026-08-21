/** Core domain types for Inspection Center */

export type InspectionType =
  | "CHECKLIST"
  | "STATE_INSPECTION"
  | "NIGHT_INSPECTION"
  | "JOINT_INSPECTION"
  | "UNPLANNED_INSPECTION"
  | "DOCUMENT_INSPECTION";

export const INSPECTION_TYPE_LABELS: Record<InspectionType, string> = {
  CHECKLIST: "Хяналт шалгалтын хуудас",
  STATE_INSPECTION: "Төрийн байгууллагын ХШ",
  NIGHT_INSPECTION: "Шөнийн ХШ",
  JOINT_INSPECTION: "Хамтарсан ХШ",
  UNPLANNED_INSPECTION: "Төлөвлөгөөт бус / бусад ХШ",
  DOCUMENT_INSPECTION: "Баримт бичгийн ХШ",
};

export type PlanStatus =
  | "draft"
  | "planned"
  | "in_progress"
  | "completed"
  | "cancelled";

export type RunStatus =
  | "draft"
  | "in_progress"
  | "submitted"
  | "completed"
  | "cancelled";

export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  draft: "Төлөвлөсөн",
  in_progress: "Хийгдэж байгаа",
  submitted: "Хийгдсэн",
  completed: "Хийгдсэн",
  cancelled: "Цуцалсан",
};

export const INSPECTION_RUN_SAVE_STATUS_OPTIONS: Array<{
  value: Exclude<RunStatus, "submitted">;
  label: string;
}> = [
  { value: "draft", label: RUN_STATUS_LABELS.draft },
  { value: "in_progress", label: RUN_STATUS_LABELS.in_progress },
  { value: "completed", label: RUN_STATUS_LABELS.completed },
  { value: "cancelled", label: RUN_STATUS_LABELS.cancelled },
];

export type InspectionRunSaveStatus =
  (typeof INSPECTION_RUN_SAVE_STATUS_OPTIONS)[number]["value"];

export function isInspectionRunSaveStatus(
  value: string | undefined | null,
): value is InspectionRunSaveStatus {
  return INSPECTION_RUN_SAVE_STATUS_OPTIONS.some(
    (option) => option.value === value,
  );
}

export function normalizeRunExecutionStatus(
  status: RunStatus,
): "in_progress" | "completed" | "planned" | "cancelled" {
  if (status === "completed" || status === "submitted") return "completed";
  if (status === "draft") return "planned";
  if (status === "cancelled") return "cancelled";
  return "in_progress";
}

export type ComplianceStatus =
  | "pass"
  | "fail"
  | "partial"
  | "not_applicable";

export const COMPLIANCE_STATUS_LABELS: Record<ComplianceStatus, string> = {
  pass: "Хангасан",
  fail: "Хангаагүй",
  partial: "Хэсэгчилсэн",
  not_applicable: "Хамааралгүй",
};

export type FindingType =
  | "violation"
  | "nonconformity"
  | "observation"
  | "risk";

export const FINDING_TYPE_LABELS: Record<FindingType, string> = {
  violation: "Зөрчил",
  nonconformity: "Үл тохирол",
  observation: "Ажиглалт",
  risk: "Эрсдэл",
};

export type Severity = "low" | "medium" | "high" | "critical";

export const SEVERITY_LABELS: Record<Severity, string> = {
  low: "Бага",
  medium: "Дунд",
  high: "Их",
  critical: "Маш их",
};

export type FindingStatus = "open" | "in_progress" | "resolved" | "closed";

export const FINDING_STATUS_LABELS: Record<FindingStatus, string> = {
  open: "Нээлттэй",
  in_progress: "Хийгдэж байгаа",
  resolved: "Шийдвэрлэсэн",
  closed: "Хаагдсан",
};

export type ActionStatus =
  | "assigned"
  | "in_progress"
  | "submitted"
  | "verified"
  | "closed"
  | "overdue";

export const ACTION_STATUS_LABELS: Record<ActionStatus | "no_action", string> = {
  assigned: "Хуваарилсан",
  in_progress: "Хийгдэж байгаа",
  submitted: "Илгээсэн",
  verified: "Баталгаажсан",
  closed: "Хаагдсан",
  overdue: "Хугацаа хэтэрсэн",
  no_action: "Төлөвлөгөөгүй",
};

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  draft: "Ноорог",
  planned: "Төлөвлөсөн",
  in_progress: "Хийгдэж байгаа",
  completed: "Хийгдсэн",
  cancelled: "Цуцалсан",
};

export type RiskLevel = "Бага" | "Дунд" | "Их";

export function labelOf(
  map: Record<string, string>,
  value: string | null | undefined,
): string {
  if (!value) return "—";
  return map[value] ?? value;
}

export interface InspectionTemplate {
  id: string;
  code: string;
  title: string;
  category: string;
  sourceSheetName: string;
  regulatorySource?: string;
  active: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionTemplateSection {
  id: string;
  templateId: string;
  parentId: string | null;
  sectionNo: string;
  title: string;
  orderIndex: number;
}

export interface InspectionTemplateQuestion {
  id: string;
  templateId: string;
  sectionId: string | null;
  questionNo: string;
  legalReference: string;
  questionText: string;
  approvedScore: number;
  orderIndex: number;
  active: boolean;
  sourceSheetName?: string;
  sourceCellRef?: string;
  rawText?: string;
}

export interface InspectionPlan {
  id: string;
  title: string;
  inspectionType: InspectionType;
  year: number;
  month: number | null;
  plannedDate: string | null;
  targetOrgUnitId: string | null;
  targetDepartmentId: string | null;
  targetLocationId: string | null;
  responsibleTeamId: string | null;
  status: PlanStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type JointUnitAnswerState = {
  isApplicable: boolean;
  receivedScore: number;
  comment: string;
  photoUrl?: string | null;
  photoName?: string | null;
};

export type InspectionPerformer = {
  name: string;
  position: string;
};

export type JointUnitScope = {
  unitKey: string;
  label: string;
  saved: boolean;
  savedAt: string | null;
  answers: Record<string, JointUnitAnswerState>;
};

export interface InspectionRun {
  id: string;
  planId: string | null;
  templateId: string | null;
  inspectionType: InspectionType;
  planMetric?: AnnualPlanMetric | null;
  title: string;
  inspectedByOrg: string;
  inspectionDate: string;
  dueDate?: string | null;
  completedDate?: string | null;
  followUpOfRunId?: string | null;
  followUpNotes?: string;
  targetOrgUnitId: string | null;
  targetDepartmentId: string | null;
  targetLocationId: string | null;
  leadInspectorId: string;
  status: RunStatus;
  notes: string;
  /** ХШ гүйцэтгэсэн ажилтан (нэр, албан тушаал) */
  performers?: InspectionPerformer[];
  /** Хамтарсан/шөнийн ХШ: хэсэг·байршлын бөглөлт */
  jointUnitScopes?: JointUnitScope[];
  activeJointUnitKey?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionAnswer {
  id: string;
  runId: string;
  templateQuestionId: string;
  isApplicable: boolean;
  approvedScore: number;
  receivedScore: number;
  complianceStatus: ComplianceStatus;
  comment: string;
  answeredBy: string;
  answeredAt: string;
}

export interface InspectionFinding {
  id: string;
  runId: string;
  answerId: string | null;
  findingType: FindingType;
  severity: Severity;
  title: string;
  description: string;
  sourceText: string;
  targetOrgUnitId: string | null;
  targetDepartmentId: string | null;
  targetJobPositionId: string | null;
  /** Link to bgs-policy-compliance clause */
  policyClauseId: string | null;
  /**
   * Хамтарсан/шөнийн ХШ: нэгж·талбайн түлхүүр.
   * Нэг асуулт дээр олон нэгжийн зөрчлийг тусад нь холбоно.
   */
  jointUnitKey?: string | null;
  status: FindingStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CorrectiveAction {
  id: string;
  findingId: string;
  actionText: string;
  responsibleEmployeeId: string | null;
  responsibleJobPositionId: string | null;
  responsibleOrgUnitId: string | null;
  progressPercent: number;
  startDate: string | null;
  dueDate: string | null;
  completedDate: string | null;
  status: ActionStatus;
  managerComment: string;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionEvidence {
  id: string;
  runId: string;
  answerId: string | null;
  findingId: string | null;
  actionId: string | null;
  fileUrl: string;
  fileType: string;
  caption: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface InspectionScoreSnapshot {
  id: string;
  runId: string;
  applicableQuestionCount: number;
  passedQuestionCount: number;
  failedQuestionCount: number;
  approvedScoreTotal: number;
  receivedScoreTotal: number;
  compliancePercent: number;
  failedScoreTotal: number;
  riskPercent: number;
  riskLevel: RiskLevel;
  calculatedAt: string;
}

export interface RiskThresholds {
  /** Run score: Бага if riskPercent < this (0–1). */
  lowMaxExclusive: number;
  /** Run score: Дунд if riskPercent < this (0–1). */
  mediumMaxExclusive: number;
  /** Combined finding score bands (0–100). */
  findingMediumMin: number;
  findingHighMin: number;
  findingCriticalMin: number;
  /** Severity floor used in max(ноцтол, гүйцэтгэлийн эрсдэл). */
  severityBase: Record<Severity, number>;
}

export const DEFAULT_SEVERITY_BASE: Record<Severity, number> = {
  low: 20,
  medium: 40,
  high: 60,
  critical: 80,
};

export const DEFAULT_RISK_THRESHOLDS: RiskThresholds = {
  lowMaxExclusive: 0.3,
  mediumMaxExclusive: 0.6,
  findingMediumMin: 35,
  findingHighMin: 60,
  findingCriticalMin: 80,
  severityBase: { ...DEFAULT_SEVERITY_BASE },
};

function clampPercent(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function asUnitInterval(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  const ratio = value > 1 ? value / 100 : value;
  return Math.min(1, Math.max(0, ratio));
}

export function normalizeRiskThresholds(value: unknown): RiskThresholds {
  const t =
    value && typeof value === "object"
      ? (value as Partial<RiskThresholds> & {
          severityBase?: Partial<Record<Severity, number>>;
        })
      : {};
  const base: Partial<Record<Severity, number>> = t.severityBase ?? {};
  const lowMaxExclusive = asUnitInterval(
    Number(t.lowMaxExclusive),
    DEFAULT_RISK_THRESHOLDS.lowMaxExclusive,
  );
  const mediumMaxExclusive = Math.max(
    lowMaxExclusive,
    asUnitInterval(
      Number(t.mediumMaxExclusive),
      DEFAULT_RISK_THRESHOLDS.mediumMaxExclusive,
    ),
  );
  const findingMediumMin = clampPercent(
    Number(t.findingMediumMin),
    DEFAULT_RISK_THRESHOLDS.findingMediumMin,
  );
  const findingHighMin = Math.max(
    findingMediumMin,
    clampPercent(Number(t.findingHighMin), DEFAULT_RISK_THRESHOLDS.findingHighMin),
  );
  const findingCriticalMin = Math.max(
    findingHighMin,
    clampPercent(
      Number(t.findingCriticalMin),
      DEFAULT_RISK_THRESHOLDS.findingCriticalMin,
    ),
  );

  return {
    lowMaxExclusive,
    mediumMaxExclusive,
    findingMediumMin,
    findingHighMin,
    findingCriticalMin,
    severityBase: {
      low: clampPercent(Number(base.low), DEFAULT_SEVERITY_BASE.low),
      medium: clampPercent(Number(base.medium), DEFAULT_SEVERITY_BASE.medium),
      high: clampPercent(Number(base.high), DEFAULT_SEVERITY_BASE.high),
      critical: clampPercent(Number(base.critical), DEFAULT_SEVERITY_BASE.critical),
    },
  };
}

export function formatRunRiskBands(t: RiskThresholds) {
  const low = Math.round(t.lowMaxExclusive * 100);
  const mid = Math.round(t.mediumMaxExclusive * 100);
  return [
    { key: "low", label: "Бага", range: `0–${low}%` },
    { key: "medium", label: "Дунд", range: `${low}–${mid}%` },
    { key: "high", label: "Их", range: `${mid}–100%` },
  ] as const;
}

export function formatFindingRiskBands(t: RiskThresholds) {
  return [
    {
      key: "low",
      label: "Бага",
      range: `0–${Math.max(0, t.findingMediumMin - 1)}%`,
    },
    {
      key: "medium",
      label: "Дунд",
      range: `${t.findingMediumMin}–${Math.max(t.findingMediumMin, t.findingHighMin - 1)}%`,
    },
    {
      key: "high",
      label: "Их",
      range: `${t.findingHighMin}–${Math.max(t.findingHighMin, t.findingCriticalMin - 1)}%`,
    },
    {
      key: "critical",
      label: "Маш их",
      range: `${t.findingCriticalMin}–100%`,
    },
  ] as const;
}

export interface InspectionCenterData {
  templates: InspectionTemplate[];
  sections: InspectionTemplateSection[];
  questions: InspectionTemplateQuestion[];
  plans: InspectionPlan[];
  runs: InspectionRun[];
  answers: InspectionAnswer[];
  findings: InspectionFinding[];
  actions: CorrectiveAction[];
  evidence: InspectionEvidence[];
  scoreSnapshots: InspectionScoreSnapshot[];
  riskThresholds: RiskThresholds;
}

export interface ChecklistCatalogItem {
  id?: string;
  sequence: number;
  department: string;
  orgUnit: string;
  code: string;
  title: string;
  sourceSheetName: string;
  sourceRow?: number;
}

export interface JointInspectionItem {
  id?: string;
  sequence: number;
  category: string;
  item: string;
  maxScore: number | null;
  score: number | null;
  sourceSheetName: string;
  sourceRow?: number;
}

export interface StateInspectionProgressRow {
  id?: string;
  sequence: number;
  authority: string;
  checklistNumber: string;
  checklistName: string;
  inspectionDate: string;
  requiredScoreFormulaOrValue: string;
  failedScore: number | null;
  riskPercentFormulaOrValue: string;
  implementationFormulaOrValue: string;
  violationCountFormulaOrValue: string;
  executionStatus: string;
  responsibleEmployee: string;
  progressPercent: number | null;
  dueDate: string;
  sourceSheetName: string;
  sourceRow?: number;
}

export interface NightInspectionItem {
  id?: string;
  sequence: number;
  area: string;
  sectionNo: string;
  sectionTitle: string;
  item: string;
  note: string;
  sourceSheetName: string;
  sourceRow?: number;
}

export interface DocumentInspectionItem {
  id?: string;
  sequence: number;
  listItem: string;
  category: string;
  responsibleDepartment: string;
  responsiblePosition: string;
  existsText: string;
  dueOrLatestDate: string;
  note: string;
  additionalNote: string;
  sourceSheetName: string;
  sourceRow?: number;
}

export interface MasterWorkbookData {
  importedAt?: string;
  workbookPath?: string;
  sheetSummary?: unknown;
  checklistCatalog: ChecklistCatalogItem[];
  jointInspectionItems: JointInspectionItem[];
  stateInspectionRows: StateInspectionProgressRow[];
  nightInspectionItems: NightInspectionItem[];
  documentInspectionItems: DocumentInspectionItem[];
}

export type AnnualPlanMetric =
  | "planned"
  | "unplanned"
  | "completed"
  | "as_needed"
  | "regular";

export interface AnnualPlanRow {
  id: string;
  inspectionType: InspectionType;
  templateId?: string | null;
  checklistName: string;
  metric: AnnualPlanMetric;
  year: number;
  months: Record<string, number>;
  detailDates: Record<string, string[]>;
  createdAt: string;
  updatedAt: string;
}

/** Yearly planned inspection counts by ХШ type (улирал / сар / ээлж). */
export type AnnualPlanPeriodKey = "quarter" | "month" | "shift";

export interface AnnualPlanPeriodCounts {
  quarter: number;
  month: number;
  shift: number;
}

export interface AnnualPlanTypeTarget {
  year: number;
  counts: Partial<Record<InspectionType, AnnualPlanPeriodCounts>>;
  /** Checklist templateId -> 12 month checkboxes (1..12). */
  checklistMonths?: Record<string, boolean[]>;
  notes: Partial<Record<InspectionType, string>>;
  createdAt: string;
  updatedAt: string;
}

/** Types shown in the yearly-by-type plan table. */
export const ANNUAL_PLAN_TYPE_ORDER: InspectionType[] = [
  "CHECKLIST",
  "NIGHT_INSPECTION",
  "JOINT_INSPECTION",
  "DOCUMENT_INSPECTION",
];

export function emptyAnnualPlanPeriodCounts(): AnnualPlanPeriodCounts {
  return { quarter: 0, month: 0, shift: 0 };
}

export function emptyAnnualPlanTypeCounts(): Record<
  InspectionType,
  AnnualPlanPeriodCounts
> {
  return {
    STATE_INSPECTION: emptyAnnualPlanPeriodCounts(),
    CHECKLIST: emptyAnnualPlanPeriodCounts(),
    NIGHT_INSPECTION: emptyAnnualPlanPeriodCounts(),
    JOINT_INSPECTION: emptyAnnualPlanPeriodCounts(),
    DOCUMENT_INSPECTION: emptyAnnualPlanPeriodCounts(),
    UNPLANNED_INSPECTION: emptyAnnualPlanPeriodCounts(),
  };
}

export function totalAnnualPlanPeriodCounts(
  counts: AnnualPlanPeriodCounts | number | null | undefined,
): number {
  if (counts == null) return 0;
  if (typeof counts === "number") return Math.max(0, counts);
  return (
    Math.max(0, Number(counts.quarter) || 0) +
    Math.max(0, Number(counts.month) || 0) +
    Math.max(0, Number(counts.shift) || 0)
  );
}

export function normalizeAnnualPlanPeriodCounts(
  value: unknown,
): AnnualPlanPeriodCounts {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const row = value as Partial<AnnualPlanPeriodCounts>;
    return {
      quarter: Math.max(0, Number(row.quarter) || 0),
      month: Math.max(0, Number(row.month) || 0),
      shift: Math.max(0, Number(row.shift) || 0),
    };
  }
  const legacy = Math.max(0, Number(value) || 0);
  return { quarter: 0, month: 0, shift: legacy };
}

export function emptyChecklistMonthRow(): boolean[] {
  return Array.from({ length: 12 }, () => false);
}

export function normalizeChecklistMonths(
  value: unknown,
): Record<string, boolean[]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const next: Record<string, boolean[]> = {};
  for (const [templateId, months] of Object.entries(
    value as Record<string, unknown>,
  )) {
    const row = Array.isArray(months) ? months : [];
    next[templateId] = Array.from({ length: 12 }, (_, index) =>
      Boolean(row[index]),
    );
  }
  return next;
}

export function countChecklistMonthSelections(
  checklistMonths: Record<string, boolean[]> | null | undefined,
): number {
  if (!checklistMonths) return 0;
  return Object.values(checklistMonths).reduce(
    (sum, months) => sum + months.filter(Boolean).length,
    0,
  );
}
