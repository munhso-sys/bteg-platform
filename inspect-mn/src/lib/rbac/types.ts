export type RoleId =
  | "admin"
  | "leadership"
  | "dxsh_head"
  | "dxsh_specialist"
  | "unit_manager"
  | "senior_specialist"
  | "specialist"
  | "junior_specialist"
  | "employee"
  | "assistant";

export type PermissionId =
  | "portal.admin"
  | "portal.settings"
  | "module.policy.view"
  | "module.policy.edit"
  | "module.inspection.view"
  | "module.inspection.edit"
  | "module.inspection.unit_findings.view"
  | "module.development.view"
  | "module.development.edit"
  | "module.guidance.view"
  | "module.guidance.edit"
  | "module.voice.view"
  | "module.voice.edit"
  | "module.ai.view"
  | "module.review.view"
  | "module.results.view"
  | "module.smartmine.view"
  | "module.tools.view";

export type UserProfile = {
  user_id: string;
  email: string;
  full_name: string;
  phone: string | null;
  heltes_id: string | null;
  heltes_name: string | null;
  alba_id: string | null;
  alba_name: string | null;
  position_id: string | null;
  position_name: string | null;
  role_id: RoleId | null;
  status: "pending" | "active" | "suspended";
  telegram_id?: string | null;
};

/** Module href → required permission to open in portal nav. */
export const MODULE_VIEW_PERMISSION: Record<string, PermissionId> = {
  inspection: "module.inspection.view",
  "policy-compliance": "module.policy.view",
  guidance: "module.guidance.view",
  development: "module.development.view",
  "employee-voice": "module.voice.view",
  "risk-management": "module.results.view",
  "report-analysis": "module.results.view",
  smartmine: "module.smartmine.view",
  "ai-assistant": "module.ai.view",
  "policy-review": "module.review.view",
  settings: "portal.settings",
  "management-center": "portal.admin",
};

/** Unit managers / senior specialists may open inspection for unit findings only. */
export const UNIT_FINDINGS_ROLES: RoleId[] = [
  "unit_manager",
  "senior_specialist",
];
