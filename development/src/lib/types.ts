export type ProgramPillarId =
  | "research"
  | "productivity"
  | "digital-learning";

export type QuarterKey = "q1" | "q2" | "q3" | "q4";

export type QuarterMark = "none" | "planned" | "done";

export type ProgramStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "delayed";

export interface ProgramInitiative {
  id: string;
  pillarId: ProgramPillarId;
  no: number;
  title: string;
  owner: string;
  department: string;
  score: number;
  target: number;
  status: ProgramStatus;
  year: number;
  start_date: string;
  end_date: string;
  quarters: Record<QuarterKey, QuarterMark>;
}

export interface ResultMetric {
  id: string;
  pillarId: ProgramPillarId;
  label: string;
  target: string;
  actual: string;
  owner: string;
  progress: number;
}

export interface VoiceReport {
  id: string;
  pillarId: ProgramPillarId;
  no: number;
  title: string;
  participants: number;
  responsible: string;
  submittedAt: string;
  status: ProgramStatus;
}

export interface FeedbackItem {
  id: string;
  type: "question" | "suggestion" | "participation";
  title: string;
  department: string;
  count: number;
  status: ProgramStatus;
}

export type ProjectStatus = "active" | "completed" | "hold";
export type ProjectPriority = "low" | "medium" | "high";

export interface ResearchProject {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: ProjectPriority;
  status: ProjectStatus;
  owner: string;
  result_summary: string;
  next_step: string;
  start_date: string;
  end_date: string;
  extended_end_date: string;
  progress: number;
  issue: string;
  pending_decision: string;
  is_urgent: boolean;
  file_name: string;
  file_url: string;
}
