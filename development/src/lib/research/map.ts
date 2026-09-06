import type { ResearchProject } from "@/lib/types";

export type ResearchProjectRow = {
  id: string;
  organization_id: string;
  created_by: string;
  title: string;
  description: string;
  category: string;
  priority: ResearchProject["priority"];
  status: ResearchProject["status"];
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
};

export function rowToProject(row: ResearchProjectRow): ResearchProject {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    priority: row.priority,
    status: row.status,
    owner: row.owner,
    result_summary: row.result_summary,
    next_step: row.next_step,
    start_date: row.start_date,
    end_date: row.end_date,
    extended_end_date: row.extended_end_date,
    progress: row.progress,
    issue: row.issue,
    pending_decision: row.pending_decision,
    is_urgent: row.is_urgent,
    file_name: row.file_name,
    file_url: row.file_url,
  };
}

export function projectToRow(
  project: Partial<ResearchProject>,
  organizationId: string,
  userId: string,
): Record<string, unknown> {
  return {
    organization_id: organizationId,
    created_by: userId,
    updated_by: userId,
    title: project.title ?? "",
    description: project.description ?? "",
    category: project.category ?? "",
    priority: project.priority ?? "medium",
    status: project.status ?? "active",
    owner: project.owner ?? "",
    result_summary: project.result_summary ?? "",
    next_step: project.next_step ?? "",
    start_date: project.start_date ?? "",
    end_date: project.end_date ?? "",
    extended_end_date: project.extended_end_date ?? "",
    progress: Math.max(0, Math.min(100, Number(project.progress) || 0)),
    issue: project.issue ?? "",
    pending_decision: project.pending_decision ?? "",
    is_urgent: Boolean(project.is_urgent),
    file_name: project.file_name ?? "",
    file_url: project.file_url ?? "",
    updated_at: new Date().toISOString(),
  };
}
