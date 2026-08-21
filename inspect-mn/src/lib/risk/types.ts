export type RiskSource = "inspection" | "policy" | "development" | "voice";
export type RiskSeverity = "low" | "medium" | "high" | "critical";
export type RiskWorkStatus = "open" | "in_progress" | "overdue" | "mitigated";

export type RiskSignal = {
  id: string;
  source: RiskSource;
  sourceLabel: string;
  title: string;
  description: string;
  unit: string;
  owner: string;
  severity: RiskSeverity;
  score: number;
  status: RiskWorkStatus;
  likelihood: number;
  impact: number;
  mitigation: {
    summary: string;
    progressPercent: number;
    dueDate: string | null;
    workStatus: string;
  };
  href: string;
  updatedAt: string;
};

export type RiskSourceSummary = {
  source: RiskSource;
  label: string;
  count: number;
  highCount: number;
  overdueCount: number;
  avgScore: number;
  inProgressCount: number;
};

export type RiskMatrixCell = {
  likelihood: number;
  impact: number;
  count: number;
};

export type RiskOverview = {
  generatedAt: string;
  sourcesOnline: Record<RiskSource, boolean>;
  sourceErrors: Partial<Record<RiskSource, string>>;
  kpis: {
    active: number;
    high: number;
    inProgress: number;
    overdue: number;
    avgResidual: number;
    coveragePercent: number;
  };
  bySource: RiskSourceSummary[];
  matrix: RiskMatrixCell[];
  conclusion: string[];
  items: RiskSignal[];
};
