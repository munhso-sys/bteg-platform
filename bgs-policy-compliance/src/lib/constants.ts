import type { ComplianceStatus, PolicyStatus, ResponsibilityType } from "./types";

export const RESPONSIBILITY_LABELS: Record<ResponsibilityType, string> = {
  IMPLEMENTATION: "Гүйцэтгэх",
  MONITORING: "Хянах / шалгах",
  VERIFICATION: "Баталгаажуулах",
  DEPLOYMENT: "Хэрэгжүүлэх / нэвтрүүлэх",
};

export const RESPONSIBILITY_SHORT: Record<ResponsibilityType, string> = {
  IMPLEMENTATION: "Гүйцэтгэх",
  MONITORING: "Хянах",
  VERIFICATION: "Баталгаажуулах",
  DEPLOYMENT: "Нэвтрүүлэх",
};

export const COMPLIANCE_STATUS_LABELS: Record<ComplianceStatus, string> = {
  not_started: "Эхлээгүй",
  in_progress: "Явцтай",
  partially_compliant: "Хэсэгчлэн",
  compliant: "Нийцсэн",
  non_compliant: "Нийцээгүй",
  not_applicable: "Хамаарахгүй",
};

export const POLICY_STATUS_LABELS: Record<PolicyStatus, string> = {
  draft: "Ноорог",
  active: "Идэвхтэй",
  archived: "Идэвхгүй",
};

/** Allowed next statuses from each current status (UI menu). */
export const POLICY_STATUS_TRANSITIONS: Record<PolicyStatus, PolicyStatus[]> = {
  draft: ["active"],
  active: ["archived", "draft"],
  archived: ["active", "draft"],
};

export const SCOPE_TYPE_LABELS: Record<string, string> = {
  organization: "Байгууллага",
  gazar: "Газар",
  heltes: "Хэлтэс",
  alba: "Алба",
  department: "Хэлтэс",
  unit: "Нэгж",
  position: "Ажлын байр",
};

export const SCORE_RULES = [
  { score: 0, label: "эхлээгүй / нотлох баримтгүй" },
  { score: 25, label: "сул биелэлт" },
  { score: 50, label: "хэсэгчилсэн биелэлт" },
  { score: 75, label: "ихэнх нь биелсэн" },
  { score: 100, label: "бүрэн нийцсэн" },
] as const;

export function scoreToStatus(score: number): ComplianceStatus {
  if (score <= 0) return "not_started";
  if (score < 40) return "non_compliant";
  if (score < 70) return "partially_compliant";
  if (score < 90) return "in_progress";
  return "compliant";
}

export function scoreTone(score: number | null | undefined): string {
  if (score == null || Number.isNaN(score)) return "bg-slate-100 text-slate-700";
  if (score >= 90) return "bg-emerald-100 text-emerald-800";
  if (score >= 70) return "bg-lime-100 text-lime-800";
  if (score >= 40) return "bg-amber-100 text-amber-900";
  if (score > 0) return "bg-orange-100 text-orange-900";
  return "bg-rose-100 text-rose-800";
}

export function responsibilityTone(type: ResponsibilityType): string {
  switch (type) {
    case "IMPLEMENTATION":
      return "bg-sky-100 text-sky-800";
    case "MONITORING":
      return "bg-violet-100 text-violet-800";
    case "VERIFICATION":
      return "bg-teal-100 text-teal-800";
    case "DEPLOYMENT":
      return "bg-fuchsia-100 text-fuchsia-800";
  }
}
