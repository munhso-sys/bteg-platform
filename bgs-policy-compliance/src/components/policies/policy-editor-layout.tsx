"use client";

import type { ReactNode } from "react";
import type { LinkScoreRow } from "@/lib/policy-kpis";
import { JobPositionDragTray } from "@/components/policies/job-position-drag-tray";
import { PolicyJobDragProvider } from "@/components/policies/policy-job-drag-context";

export function PolicyEditorLayout({
  policyId,
  clauses,
  linkRows,
  workbench,
  sidebarTop,
}: {
  policyId: string;
  clauses: Array<{
    id: string;
    sectionId?: string | null;
    parentId?: string | null;
  }>;
  linkRows: LinkScoreRow[];
  workbench: ReactNode;
  /** Panels above connected positions (add section / clause). */
  sidebarTop: ReactNode;
}) {
  return (
    <PolicyJobDragProvider policyId={policyId} clauses={clauses}>
      <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">{workbench}</div>
        <aside className="space-y-3">
          {sidebarTop}
          <div className="lg:sticky lg:top-3 lg:z-10">
            <JobPositionDragTray policyId={policyId} linkRows={linkRows} />
          </div>
        </aside>
      </div>
    </PolicyJobDragProvider>
  );
}
