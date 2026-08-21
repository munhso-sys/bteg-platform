export const GUIDANCE_STATUSES = ["planned", "in_progress", "blocked", "completed"] as const;
export type GuidanceStatus = (typeof GUIDANCE_STATUSES)[number];

export const GUIDANCE_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type GuidancePriority = (typeof GUIDANCE_PRIORITIES)[number];

export const GUIDANCE_UPDATE_KINDS = ["plan", "execution", "progress", "result"] as const;
export type GuidanceUpdateKind = (typeof GUIDANCE_UPDATE_KINDS)[number];

export type GuidanceUpdate = {
  id: string;
  kind: GuidanceUpdateKind;
  note: string;
  progress: number;
  createdAt: string;
  createdBy: string;
  createdByName: string;
};

export type GuidanceRecord = {
  id: string;
  referenceNo: string;
  title: string;
  objective: string;
  priority: GuidancePriority;
  status: GuidanceStatus;
  progress: number;
  directiveDate: string;
  dueDate: string;
  ownerName: string;
  unitName: string;
  planDetails: string;
  executionNotes: string;
  resultSummary: string;
  resultMetric: string;
  evidence: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  updatedAt: string;
  updates: GuidanceUpdate[];
};

export type GuidanceDb = { items: GuidanceRecord[] };

export function emptyGuidanceDb(): GuidanceDb {
  return { items: [] };
}

export function clampProgress(value: unknown) {
  return Math.min(100, Math.max(0, Number(value) || 0));
}

export function isGuidanceStatus(value: unknown): value is GuidanceStatus {
  return typeof value === "string" && (GUIDANCE_STATUSES as readonly string[]).includes(value);
}

export function isGuidancePriority(value: unknown): value is GuidancePriority {
  return typeof value === "string" && (GUIDANCE_PRIORITIES as readonly string[]).includes(value);
}

export function isGuidanceUpdateKind(value: unknown): value is GuidanceUpdateKind {
  return typeof value === "string" && (GUIDANCE_UPDATE_KINDS as readonly string[]).includes(value);
}
