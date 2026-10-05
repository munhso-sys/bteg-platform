export type PolicyStatus = "draft" | "active" | "archived";

export type ResponsibilityType =
  | "IMPLEMENTATION"
  | "MONITORING"
  | "VERIFICATION"
  | "DEPLOYMENT";

export type ComplianceStatus =
  | "not_started"
  | "in_progress"
  | "partially_compliant"
  | "compliant"
  | "non_compliant"
  | "not_applicable";

export type OrgUnitType =
  | "organization"
  | "gazar"
  | "heltes"
  | "alba"
  | "other";

export type AppRole = "admin" | "evaluator" | "viewer";

export interface OrgUnit {
  id: string;
  bteg_id: string | null;
  name: string;
  unit_type: OrgUnitType;
  parent_id: string | null;
  parent_bteg_id: string | null;
  is_active: boolean;
}

export interface Policy {
  id: string;
  name: string;
  approved_date: string | null;
  reference_code: string | null;
  /**
   * Optional official job-position code (албан тушаалын код).
   * Older rows may omit this field — treat as null.
   */
  official_code?: string | null;
  status: PolicyStatus;
  version: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface PolicySection {
  id: string;
  policy_id: string;
  text: string | null;
  reference_number: string | null;
  sort_order: number;
  is_deleted: boolean;
}

export interface PolicyClause {
  id: string;
  policy_id: string;
  section_id: string | null;
  parent_id: string | null;
  reference_number: string | null;
  text: string;
  sort_order: number;
  is_deleted: boolean;
}

export interface JobPosition {
  id: string;
  bteg_id: string | null;
  /** Official position code used to copy clause links onto newly created jobs. */
  official_code: string | null;
  name: string;
  organization_id: string | null;
  /** Free-text organization label (UI grouping). */
  organization_name: string | null;
  gazar_id: string | null;
  heltes_id: string | null;
  alba_id: string | null;
  heltes_name: string | null;
  alba_name: string | null;
  org_unit_id: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** Мэргэжлийн ур чадварын ангилал (Загвар.docx D хэсэг). */
export type JobDescriptionSkillCategory = {
  title: string;
  items: string[];
};

/**
 * Ажлын байрны тодорхойлолт — Загвар.docx (А–E) бүтэц.
 * Хуучин string талбарууд normalize хийгдэнэ (authority/responsibilities гэх мэт).
 */
export interface JobDescription {
  id: string;
  job_position_id: string;
  title: string | null;
  /** Үндэсний ажил мэргэжлийн ангиллын код (жнь. 1322-11) */
  a_code: string | null;
  /** Албан тушаалын код (жнь. 103) */
  position_code?: string | null;
  company_name?: string | null;
  location?: string | null;
  unit_name?: string | null;
  purpose: string | null;
  schedule: string | null;
  daily_hours: string | null;
  break_time: string | null;
  /** B хэсгийн «Албан тушаал» тайлбар */
  position_note?: string | null;
  duties: unknown[];
  education_level: string | null;
  work_experience: string | null;
  general_skills: unknown[];
  /** string[] эсвэл JobDescriptionSkillCategory[] */
  professional_skills: unknown[];
  /** string | string[] (дугаарлагдсан мөр) */
  authority: string | string[] | null;
  /** string | string[] (дугаарлагдсан мөр) */
  responsibilities: string | string[] | null;
  relevant_laws: unknown[];
  job_condition: string | null;
  resources: string | null;
  required_trainings?: unknown[];
  required_certificates?: unknown[];
  property_liability?: string | null;
  other_notes?: string | null;
  communication_scope: unknown;
  supervisor_positions: unknown[];
  subordinate_positions: unknown[];
  /** Full markdown export body from BGS_export Job_descriptions/*.md */
  markdown_body?: string | null;
  raw?: unknown;
}

/** АБТ (ажлын байрны тодорхойлолт) үнэлгээ — Т-үнэлгээ. Журмын compliance_evaluations-ээс тусдаа. */
export interface JobDescriptionEvaluation {
  id: string;
  job_position_id: string;
  evaluation_period: string;
  /** 0–100 → Т-үнэлгээ багана */
  score: number;
  /** Үр дүн */
  result_text: string | null;
  /** Сайжруулах арга хэмжээ */
  improvement_actions: string | null;
  /** Ерөнхий дүгнэлт */
  conclusion: string | null;
  evaluated_at: string;
  created_at: string;
  updated_at: string;
}

export interface PolicyScopeTarget {
  id: number | string;
  policy_id: string;
  target_type: string;
  target_bteg_id: string | null;
  target_name: string | null;
  parent_bteg_id: string | null;
  org_unit_id: string | null;
  created_at?: string;
}

export interface ClausePositionResponsibility {
  id: string;
  policy_clause_id: string;
  job_position_id: string;
  /** RACI-style duty on this clause (Гүйцэтгэх / Хянах / …). */
  responsibility_type: ResponsibilityType;
  is_checked: boolean;
  is_active: boolean;
  weight: number;
  required_evidence: string | null;
  /**
   * Optional PFD keys on the JSON link document (`app_data_store` / local DB).
   * Not applied as SQL ALTER on production unless a reviewed migration is approved.
   */
  process_id?: string | null;
  location_id?: string | null;
  asset_id?: string | null;
  notes: string | null;
}

export interface ComplianceEvaluation {
  id: string;
  policy_clause_id: string;
  job_position_id: string;
  responsibility_type: ResponsibilityType;
  evaluation_period: string;
  period_start: string | null;
  period_end: string | null;
  evaluator_user_id: string | null;
  score: number;
  status: ComplianceStatus;
  comment: string | null;
  /**
   * When true: recorded for audit/attention but excluded from policy/position
   * average scores (e.g. role cannot apply / needs special change note).
   * Older rows may omit this field (treat as false).
   */
  exclude_from_average?: boolean;
  evaluated_at: string;
  created_at: string;
  updated_at: string;
}

export interface EvaluationEvidence {
  id: string;
  evaluation_id: string;
  evidence_type: string;
  title: string | null;
  content: string | null;
  url: string | null;
  file_path: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AppUser {
  id: string;
  email: string | null;
  display_name: string;
  is_active: boolean;
}

export interface LocalDatabase {
  meta: {
    imported_at: string | null;
    source_path: string | null;
    import_report: ImportReport | null;
  };
  users: AppUser[];
  org_units: OrgUnit[];
  policies: Policy[];
  policy_sections: PolicySection[];
  policy_clauses: PolicyClause[];
  job_positions: JobPosition[];
  job_descriptions: JobDescription[];
  job_description_evaluations: JobDescriptionEvaluation[];
  policy_scope_targets: PolicyScopeTarget[];
  clause_position_responsibilities: ClausePositionResponsibility[];
  compliance_evaluations: ComplianceEvaluation[];
  evaluation_evidence: EvaluationEvidence[];
}

export interface ImportReport {
  policies: number;
  sections: number;
  clauses: number;
  job_positions: number;
  job_descriptions: number;
  responsibility_links: number;
  scope_targets: number;
  org_units: number;
  missing_positions: string[];
  warnings: string[];
}

export interface ClauseTreeNode extends PolicyClause {
  children: ClauseTreeNode[];
  responsibilities: ClausePositionResponsibility[];
}

export interface DataQualityWarning {
  code: string;
  message: string;
  entity_type: string;
  entity_id?: string;
  count?: number;
}
