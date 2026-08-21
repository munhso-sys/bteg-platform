export const OTHER_WORK_CATEGORIES = ["daily", "per_shift", "recurring", "on_demand", "other"] as const;
export type OtherWorkCategory = (typeof OTHER_WORK_CATEGORIES)[number];

export const OTHER_WORK_STATUSES = ["planned", "in_progress", "handed_over", "completed", "cancelled"] as const;
export type OtherWorkStatus = (typeof OTHER_WORK_STATUSES)[number];

export type OtherWorkUpdate = {
  id: string;
  note: string;
  progress: number;
  status: OtherWorkStatus;
  createdAt: string;
  createdBy: string;
  createdByName: string;
};

export type OtherWorkRecord = {
  id: string;
  workName: string;
  category: OtherWorkCategory;
  frequencyDetail: string;
  startAt: string;
  endAt: string;
  status: OtherWorkStatus;
  progress: number;
  plan: string;
  execution: string;
  result: string;
  responsibleName: string;
  unitName: string;
  approvedByName: string;
  approvedAt: string;
  handoverToName: string;
  handoverAt: string;
  handoverNote: string;
  otherInfo: string;
  createdAt: string;
  createdBy: string;
  createdByName: string;
  updatedAt: string;
  updates: OtherWorkUpdate[];
};

export type OtherWorkDb = { items: OtherWorkRecord[] };

export function emptyOtherWorkDb(): OtherWorkDb {
  return { items: [] };
}

export function isOtherWorkCategory(value: unknown): value is OtherWorkCategory {
  return typeof value === "string" && (OTHER_WORK_CATEGORIES as readonly string[]).includes(value);
}

export function isOtherWorkStatus(value: unknown): value is OtherWorkStatus {
  return typeof value === "string" && (OTHER_WORK_STATUSES as readonly string[]).includes(value);
}

export function otherWorkProgress(value: unknown) {
  return Math.min(100, Math.max(0, Number(value) || 0));
}
