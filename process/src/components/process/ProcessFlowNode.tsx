"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/cn";
import type { ProcessHealth, ProcessLevel } from "@/lib/types";
import { PROCESS_LEVEL_LABELS } from "@/lib/types";

export type ProcessFlowNodeData = {
  label: string;
  code: string;
  level: ProcessLevel;
  health: ProcessHealth;
  description?: string;
};

export type ProcessFlowNode = Node<ProcessFlowNodeData, "process">;

const HEALTH_BORDER: Record<ProcessHealth, string> = {
  green: "border-[var(--health-green)] bg-emerald-50 dark:bg-emerald-950/40",
  yellow: "border-[var(--health-yellow)] bg-amber-50 dark:bg-amber-950/40",
  red: "border-[var(--health-red)] bg-rose-50 dark:bg-rose-950/40",
  neutral: "border-[var(--border)] bg-[var(--card)]",
};

const HEALTH_DOT: Record<ProcessHealth, string> = {
  green: "bg-[var(--health-green)]",
  yellow: "bg-[var(--health-yellow)]",
  red: "bg-[var(--health-red)]",
  neutral: "bg-[var(--health-neutral)]",
};

export function ProcessFlowNodeView(props: NodeProps) {
  const data = props.data as ProcessFlowNodeData;
  const selected = props.selected;

  return (
    <div
      className={cn(
        "min-w-[180px] max-w-[220px] rounded-lg border-2 px-3 py-2 shadow-sm transition",
        HEALTH_BORDER[data.health] ?? HEALTH_BORDER.neutral,
        selected && "ring-2 ring-[var(--brand)] ring-offset-1",
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-[var(--brand)]" />
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
            HEALTH_DOT[data.health] ?? HEALTH_DOT.neutral,
          )}
          title={data.health}
        />
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
            {PROCESS_LEVEL_LABELS[data.level] ?? data.level}
          </div>
          <div className="truncate text-sm font-semibold text-[var(--fg)]">
            {data.label}
          </div>
          <div className="truncate font-mono text-[11px] text-[var(--muted)]">
            {data.code}
          </div>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-[var(--brand)]" />
    </div>
  );
}
