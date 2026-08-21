export type VoiceType = "suggestion" | "request" | "complaint" | "survey";
export type VoiceStatus =
  | "new"
  | "in_progress"
  | "planned"
  | "resolved"
  | "rejected"
  | "closed";
export type VoicePriority = "low" | "medium" | "high" | "critical";
export type VoiceSource = "web" | "telegram" | "survey";
export type ActionKind = "predicted" | "planned" | "in_progress" | "done";
export type NoticeTarget = "risk" | "development";
export type NoticeStatus = "queued" | "sent" | "acknowledged";

export const VOICE_TYPE_LABELS: Record<VoiceType, string> = {
  suggestion: "Санал",
  request: "Хүсэлт",
  complaint: "Гомдол",
  survey: "Асуулга",
};

export const VOICE_STATUS_LABELS: Record<VoiceStatus, string> = {
  new: "Шинэ",
  in_progress: "Хянагдаж буй",
  planned: "Төлөвлөсөн",
  resolved: "Шийдвэрлэсэн",
  rejected: "Няцаасан",
  closed: "Хаасан",
};

export const VOICE_PRIORITY_LABELS: Record<VoicePriority, string> = {
  low: "Бага",
  medium: "Дунд",
  high: "Өндөр",
  critical: "Ноцтой",
};

export const ACTION_KIND_LABELS: Record<ActionKind, string> = {
  predicted: "Таамагласан",
  planned: "Төлөвлөсөн",
  in_progress: "Хийгдэж буй",
  done: "Гүйцэтгэсэн",
};

export type EmployeeVoiceItem = {
  id: string;
  type: VoiceType;
  title: string;
  description: string;
  status: VoiceStatus;
  priority: VoicePriority;
  department: string;
  submittedBy: string;
  assignedTo: string;
  source: VoiceSource;
  isAnonymous: boolean;
  telegramId: string | null;
  dueDate: string | null;
  voiceDate: string;
  actionTaken: string;
  analysisNote: string;
  predictedAction: string;
  notifyRisk: boolean;
  notifyResearch: boolean;
  surveyTopic: string;
  createdAt: string;
  updatedAt: string;
};

export type VoiceAction = {
  id: string;
  voiceId: string;
  title: string;
  kind: ActionKind;
  owner: string;
  dueDate: string | null;
  progressPercent: number;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type VoiceNotice = {
  id: string;
  voiceId: string;
  target: NoticeTarget;
  status: NoticeStatus;
  message: string;
  createdAt: string;
  sentAt: string | null;
};

export type TelegramVoiceUser = {
  telegramId: string;
  username: string;
  fullName: string;
  lastSeenAt: string;
  createdAt: string;
};

export type VoiceDb = {
  items: EmployeeVoiceItem[];
  actions: VoiceAction[];
  notices: VoiceNotice[];
  telegramUsers: TelegramVoiceUser[];
};

export function emptyVoiceDb(): VoiceDb {
  return { items: [], actions: [], notices: [], telegramUsers: [] };
}
