import { seedProjects } from "@/lib/projects-data";
import type { ResearchProject } from "@/lib/types";

export type DevelopmentRiskSignal = {
  id: string;
  source: "development";
  sourceLabel: string;
  title: string;
  description: string;
  unit: string;
  owner: string;
  severity: "low" | "medium" | "high" | "critical";
  score: number;
  status: "open" | "in_progress" | "overdue" | "mitigated";
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

function isAtRisk(p: ResearchProject) {
  if (p.status === "completed") return false;
  return (
    p.status === "hold" ||
    p.is_urgent ||
    Boolean(p.issue?.trim()) ||
    Boolean(p.pending_decision?.trim()) ||
    (p.priority === "high" && p.progress < 80)
  );
}

function scoreOf(p: ResearchProject) {
  let score = p.priority === "high" ? 62 : p.priority === "medium" ? 44 : 28;
  if (p.is_urgent) score += 12;
  if (p.status === "hold") score += 10;
  if (p.issue) score += 8;
  if (p.pending_decision) score += 6;
  score = Math.round(score * (1 - Math.min(p.progress, 100) / 250));
  return Math.max(20, Math.min(100, score));
}

function severityOf(score: number): DevelopmentRiskSignal["severity"] {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export function developmentRiskSignals(): DevelopmentRiskSignal[] {
  const today = new Date().toISOString().slice(0, 10);
  return seedProjects
    .filter(isAtRisk)
    .map((p) => {
      const score = scoreOf(p);
      const overdue = Boolean(p.end_date && p.end_date < today && p.status !== "completed");
      const status: DevelopmentRiskSignal["status"] = overdue
        ? "overdue"
        : p.status === "hold"
          ? "open"
          : "in_progress";
      const impact = p.priority === "high" ? 4 : p.priority === "medium" ? 3 : 2;
      return {
        id: `dev-${p.id}`,
        source: "development" as const,
        sourceLabel: "Судалгаа хөгжүүлэлт",
        title: p.title,
        description: [p.category, p.issue || p.description].filter(Boolean).join(" · "),
        unit: p.category,
        owner: p.owner,
        severity: severityOf(score),
        score,
        status,
        likelihood: p.is_urgent ? 5 : impact,
        impact,
        mitigation: {
          summary: p.next_step || p.result_summary || "Төслийн эрсдэлийг шийдвэрлэх",
          progressPercent: p.progress,
          dueDate: p.extended_end_date || p.end_date || null,
          workStatus: p.pending_decision
            ? `Шийдвэр хүлээгдэж буй: ${p.pending_decision}`
            : p.status === "hold"
              ? "Түр зогссон"
              : "Хөгжүүлэлт үргэлжилж байна",
        },
        href: "/projects",
        updatedAt: p.end_date || p.start_date,
      };
    })
    .sort((a, b) => b.score - a.score);
}
