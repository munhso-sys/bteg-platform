export type ReportLevel = "leadership" | "dxshh" | "unit" | "module";
export type KpiTone = "neutral" | "good" | "warn" | "bad";

export type ReportKpi = {
  id: string;
  label: string;
  value: string;
  hint: string;
  tone: KpiTone;
  level: ReportLevel;
  system: string;
  folder: string[];
};

export type ReportRow = {
  id: string;
  system: string;
  title: string;
  metric: string;
  value: string;
  status: string;
  owner: string;
  unit: string;
  level: ReportLevel;
  date: string;
  href: string;
};

export type TreeNode = {
  id: string;
  label: string;
  kind: "folder" | "report";
  href?: string;
  count?: number;
  children?: TreeNode[];
};

export type AnalysisTool = {
  id: string;
  label: string;
  description: string;
};

export type UnitScore = {
  unit: string;
  signals: number;
  high: number;
  overdue: number;
  voice: number;
  residual: number;
};

export type PlatformReport = {
  generatedAt: string;
  title: string;
  kpis: ReportKpi[];
  rows: ReportRow[];
  tree: TreeNode[];
  tools: AnalysisTool[];
  units: UnitScore[];
  conclusions: string[];
  bySystem: { system: string; count: number; high: number }[];
  matrix: { likelihood: number; impact: number; count: number }[];
  voiceThemes: { label: string; count: number }[];
  sourceErrors: Record<string, string>;
};

export const LEVEL_LABELS: Record<ReportLevel, string> = {
  leadership: "Удирдлага",
  dxshh: "ДХШХ",
  unit: "Нэгж",
  module: "Модуль",
};

export const ANALYSIS_TOOLS: AnalysisTool[] = [
  {
    id: "source-mix",
    label: "Эх системийн бүтэц",
    description: "ХШ, журам, СХ, дуу хоолойноос ирсэн дохионы хуваарь",
  },
  {
    id: "matrix",
    label: "Магадлал × нөлөө",
    description: "Эрсдэлийн матрицаар анхаарах бүсийг тодорхойлно",
  },
  {
    id: "units",
    label: "Нэгжийн харьцуулалт",
    description: "Алба/хэлтэсээр үлдэгдэл эрсдэл, гомдол",
  },
  {
    id: "overdue",
    label: "Хугацаа хэтэрсэн дараалал",
    description: "Засвар, хариу арга хэмжээний хоцролт",
  },
  {
    id: "voice",
    label: "Дуу хоолойн чиг",
    description: "Санал, хүсэлт, гомдол, асуулгын сэдэв",
  },
  {
    id: "coverage",
    label: "Хамрагдалт",
    description: "Төлөвлөгөөтэй vs төлөвлөгөөгүй эрсдэл",
  },
];
