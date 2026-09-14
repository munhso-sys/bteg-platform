/**
 * Cross-module Process ID contract.
 * Process owns ProcessNode IDs; other modules store optional process_id / processId.
 */
export const PROCESS_MODULE_STORE_KEY = "process_module_db";

export type LinkedModule =
  | "policy-compliance"
  | "inspection-center"
  | "risk-management"
  | "employee-voice"
  | "development";

/** Field names used today across modules (snake vs camel). */
export const PROCESS_ID_FIELDS = {
  policyResponsibility: "process_id",
  inspectionTemplate: "processId",
  inspectionFinding: "processId",
  riskSignal: "processId",
  employeeVoice: "processId",
} as const;
