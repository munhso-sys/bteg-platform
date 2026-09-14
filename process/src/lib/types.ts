/** Process Module — core domain types (PFD / BPMN / DFD). */

export type ProcessLevel =
  | "L1_MACRO"
  | "L2_SUBPROCESS"
  | "L3_ACTIVITY"
  | "L4_TASK";

export const PROCESS_LEVEL_LABELS: Record<ProcessLevel, string> = {
  L1_MACRO: "L1 · Макро",
  L2_SUBPROCESS: "L2 · Дэд процесс",
  L3_ACTIVITY: "L3 · Үйл ажиллагаа",
  L4_TASK: "L4 · Даалгавар",
};

export type ProcessNodeStatus = "ACTIVE" | "DRAFT" | "ARCHIVED";

export const PROCESS_STATUS_LABELS: Record<ProcessNodeStatus, string> = {
  ACTIVE: "Идэвхтэй",
  DRAFT: "Ноорог",
  ARCHIVED: "Архив",
};

export type ProcessHealth = "green" | "yellow" | "red" | "neutral";

export type RootCauseCategory =
  | "PROCESS_GAP"
  | "HUMAN_ERROR"
  | "EQUIPMENT_FAILURE"
  | "ENVIRONMENTAL";

export const ROOT_CAUSE_LABELS: Record<RootCauseCategory, string> = {
  PROCESS_GAP: "Процессын цоорхой",
  HUMAN_ERROR: "Хүний алдаа",
  EQUIPMENT_FAILURE: "Тоног төхөөрөмжийн эвдрэл",
  ENVIRONMENTAL: "Орчны нөхцөл",
};

export type RaciRoleKey =
  | "responsible_role"
  | "accountable_role"
  | "consulted_role"
  | "informed_role";

/* ── Process tree nodes ── */

export interface ProcessNode {
  id: string;
  code: string;
  title: string;
  description: string;
  level: ProcessLevel;
  parent_id: string | null;
  location_id: string | null;
  asset_id: string | null;
  status: ProcessNodeStatus;
  sort_order: number;
  /** Semantic version of the process definition, e.g. "1.0". */
  diagram_version?: string;
  owner?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProcessNodeTree extends ProcessNode {
  children: ProcessNodeTree[];
  health?: ProcessHealth;
}

/* ── Cross-module link caches ── */

export interface ProcessRaciLink {
  id: string;
  process_id: string;
  source: "policy" | "manual";
  source_id: string;
  title: string;
  responsible_role: string | null;
  accountable_role: string | null;
  consulted_role: string | null;
  informed_role: string | null;
}

export interface ProcessInspectionLink {
  id: string;
  process_id: string;
  checklist_name: string;
  run_id: string | null;
  completed_at: string | null;
  pass_rate: number | null;
  status: string;
}

export interface ProcessIssueLink {
  id: string;
  process_id: string;
  title: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  severity: "low" | "medium" | "high" | "critical";
  root_cause_category: RootCauseCategory | null;
  root_cause_description: string | null;
  created_at: string;
}

export interface ProcessRiskLink {
  id: string;
  process_id: string;
  title: string;
  score: number;
  level: "low" | "medium" | "high" | "critical";
  updated_at: string;
}

export interface ProcessEmployeeReportLink {
  id: string;
  process_id: string;
  title: string;
  category: string;
  status: string;
  created_at: string;
}

export interface ProcessAnalytics {
  process_id: string;
  node_ids: string[];
  procedure_compliance_rate: number;
  open_issues_count: number;
  root_cause_breakdown: Record<RootCauseCategory, number>;
  risk_score: number;
  risk_level: "low" | "medium" | "high" | "critical";
  employee_reports_count: number;
  inspection_pass_rate: number | null;
  health: ProcessHealth;
  procedures: ProcessRaciLink[];
  inspections: ProcessInspectionLink[];
  issues: ProcessIssueLink[];
  risks: ProcessRiskLink[];
  employee_reports: ProcessEmployeeReportLink[];
}

/* ── Diagram files & versioning ── */

export type ProcessFileType =
  | "bpmn"
  | "drawio"
  | "xml"
  | "pdf"
  | "xlsx"
  | "csv"
  | "other";

export type ProcessModuleCategory =
  | "PFD"
  | "BPMN"
  | "DFD"
  | "SIPOC"
  | "RACI"
  | "MATRIX"
  | "DOCUMENT"
  | "OTHER";

export interface ProcessFile {
  id: string;
  process_id: string;
  file_name: string;
  original_name: string;
  file_type: ProcessFileType;
  mime_type: string;
  /** Relative path under data/uploads/ */
  file_path: string;
  size_bytes: number;
  version: string;
  /** Previous file id when this is a new version. */
  previous_file_id: string | null;
  is_current: boolean;
  process_owner: string | null;
  module_category: ProcessModuleCategory;
  /** Parsed payload for matrix files (rows). */
  parsed_matrix_id: string | null;
  /** Draw.io / BPMN extracted shape ids for mapping. */
  diagram_node_ids: string[];
  checksum: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

/* ── DFD ── */

export type DfdLevel = "L0_CONTEXT" | "L1_FLOW" | "L2_DETAIL";

export type DfdElementKind =
  | "PROCESS"
  | "EXTERNAL_ENTITY"
  | "DATA_STORE"
  | "DATA_FLOW";

export interface DfdNode {
  id: string;
  process_id: string;
  /** Diagram shape/task id from BPMN or draw.io mxCell id. */
  diagram_node_id: string;
  label: string;
  dfd_level: DfdLevel;
  element_kind: DfdElementKind;
  data_input: string[];
  data_output: string[];
  data_store_reference: string | null;
  /** Optional JSON Schema / API payload description. */
  api_payload_schema: string | null;
  data_dictionary: Record<string, string>;
  notes: string | null;
  file_id: string | null;
  created_at: string;
  updated_at: string;
}

/* ── Process matrix (SIPOC / IPO / ГХЗМ / steps) ── */

export type MatrixKind = "SIPOC" | "IPO" | "GHZM" | "RACI" | "STEPS" | "GENERIC";

/** ГХЗМ letters map to RACI-like roles (Гүйцэтгэх/Хянах/Зөвшөөрөх/Мэдээлэх). */
export type GhzmRole = "G" | "H" | "Z" | "M" | string;

export interface ProcessMatrixRow {
  id: string;
  process_id: string;
  file_id: string | null;
  matrix_kind: MatrixKind;
  sheet_name: string | null;
  step_number: number | null;
  task_name: string;
  input_data: string | null;
  process_text: string | null;
  output_data: string | null;
  system_input: string | null;
  system_output: string | null;
  /** Role → Г/Х/З/М or R/A/C/I */
  role_matrix: Record<string, GhzmRole>;
  responsible_role: string | null;
  accountable_role: string | null;
  consulted_role: string | null;
  informed_role: string | null;
  position_title: string | null;
  notes: string | null;
  /** Optional link to diagram node. */
  diagram_node_id: string | null;
  sort_order: number;
}

export interface ProcessMatrixDocument {
  id: string;
  process_id: string;
  file_id: string;
  title: string;
  kind: MatrixKind;
  sheet_names: string[];
  row_ids: string[];
  created_at: string;
}

export interface AuditEvent {
  id: string;
  entity_type: "process_file" | "dfd_node" | "process_node" | "matrix";
  entity_id: string;
  action: "create" | "update" | "upload" | "version" | "revert" | "dfd_map";
  detail: string;
  actor: string | null;
  created_at: string;
}

export interface ProcessModuleDb {
  version: 2;
  nodes: ProcessNode[];
  raci_links: ProcessRaciLink[];
  inspection_links: ProcessInspectionLink[];
  issue_links: ProcessIssueLink[];
  risk_links: ProcessRiskLink[];
  employee_report_links: ProcessEmployeeReportLink[];
  files: ProcessFile[];
  dfd_nodes: DfdNode[];
  matrix_rows: ProcessMatrixRow[];
  matrix_docs: ProcessMatrixDocument[];
  audit: AuditEvent[];
  updated_at: string;
}

export type CreateProcessNodeInput = {
  code: string;
  title: string;
  description?: string;
  level: ProcessLevel;
  parent_id?: string | null;
  location_id?: string | null;
  asset_id?: string | null;
  status?: ProcessNodeStatus;
  sort_order?: number;
  diagram_version?: string;
  owner?: string | null;
};

export type UpdateProcessNodeInput = Partial<CreateProcessNodeInput>;

export type NodeDetailsResponse = {
  process: ProcessNode;
  diagram_node_id: string;
  dfd: DfdNode[];
  matrix_rows: ProcessMatrixRow[];
  raci: ProcessRaciLink[];
  files: ProcessFile[];
};
