"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  Folder,
  FolderOpen,
  Trash2,
} from "lucide-react";
import { StatusBadge, TableScroll } from "@/components/ui/primitives";
import { ACTION_STATUS_LABELS, labelOf } from "@/lib/types";
import {
  FINDING_RISK_LABELS,
  type CorrectiveActionRow,
} from "@/components/actions/types";

type Tone = "neutral" | "ok" | "warn" | "danger" | "brand";
type TreeMode = "plan" | "archive";

type FolderNode = {
  key: string;
  label: string;
  subtitle?: string;
  children: Array<FolderNode | CorrectiveActionRow>;
};

function isFolder(
  node: FolderNode | CorrectiveActionRow,
): node is FolderNode {
  return "children" in node;
}

function riskTone(label: string): Tone {
  if (label === "critical" || label === "high") return "danger";
  if (label === "medium") return "warn";
  return "neutral";
}

function actionTone(status: string): Tone {
  if (status === "closed" || status === "verified") return "ok";
  if (status === "overdue" || status === "no_action") return "danger";
  if (status === "submitted") return "warn";
  return "brand";
}

function collectLeaves(
  node: FolderNode | CorrectiveActionRow,
): CorrectiveActionRow[] {
  if (!isFolder(node)) return [node];
  return node.children.flatMap((child) => collectLeaves(child));
}

function collectExpandableKeys(nodes: FolderNode[]): string[] {
  const keys: string[] = [];
  for (const folder of nodes) {
    keys.push(folder.key);
    for (const child of folder.children) {
      if (isFolder(child)) keys.push(...collectExpandableKeys([child]));
    }
  }
  return keys;
}

function buildTree(rows: CorrectiveActionRow[]): FolderNode[] {
  const byRun = new Map<string, CorrectiveActionRow[]>();
  for (const row of rows) {
    const key = row.runId || row.runTitle;
    const list = byRun.get(key) ?? [];
    list.push(row);
    byRun.set(key, list);
  }

  return [...byRun.entries()]
    .map(([runId, runRows]) => {
      const sample = runRows[0];
      const bySection = new Map<string, CorrectiveActionRow[]>();
      for (const row of runRows) {
        const sectionKey = row.sectionTitle.trim() || "__none__";
        const list = bySection.get(sectionKey) ?? [];
        list.push(row);
        bySection.set(sectionKey, list);
      }

      const sectionEntries = [...bySection.entries()];
      const useSections =
        sectionEntries.length > 1 ||
        (sectionEntries.length === 1 && sectionEntries[0][0] !== "__none__");

      const children: Array<FolderNode | CorrectiveActionRow> = useSections
        ? sectionEntries.map(([sectionKey, sectionRows]) => {
            if (sectionKey === "__none__") {
              return {
                key: `${runId}::section-other`,
                label: "Бусад",
                children: sectionRows,
              } satisfies FolderNode;
            }
            return {
              key: `${runId}::section-${sectionKey}`,
              label: sectionKey,
              children: sectionRows,
            } satisfies FolderNode;
          })
        : runRows;

      return {
        key: `run-${runId}`,
        label: sample.checklistTitle || sample.runTitle,
        subtitle: [sample.inspectionTypeLabel, sample.runTitle]
          .filter(Boolean)
          .join(" · "),
        children,
      } satisfies FolderNode;
    })
    .sort((a, b) => a.label.localeCompare(b.label, "mn"));
}

function FolderRow({
  folder,
  depth,
  open,
  onToggle,
  colSpan,
  mode,
}: {
  folder: FolderNode;
  depth: number;
  open: boolean;
  onToggle: () => void;
  colSpan: number;
  mode: TreeMode;
}) {
  const leaves = collectLeaves(folder);
  const overdue = leaves.filter((row) => row.actionStatus === "overdue").length;
  const noAction = leaves.filter((row) => row.actionStatus === "no_action").length;
  const Icon = open ? FolderOpen : Folder;
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <tr className="bg-slate-50/80">
      <td colSpan={colSpan} className="align-middle">
        <button
          type="button"
          className="flex w-full items-center gap-2 py-0.5 text-left"
          style={{ paddingLeft: `${depth * 1.1}rem` }}
          onClick={onToggle}
          aria-expanded={open}
        >
          <Chevron size={14} className="shrink-0 text-[var(--muted)]" />
          <Icon size={14} className="shrink-0 text-[var(--brand)]" />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[var(--fg)]">
              {folder.label}
            </span>
            {folder.subtitle ? (
              <span className="mt-0.5 block text-xs text-[var(--muted)]">
                {folder.subtitle}
              </span>
            ) : null}
          </span>
          <span className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5 text-xs">
            <StatusBadge tone={mode === "archive" ? "ok" : "brand"}>
              {leaves.length} зөрчил
            </StatusBadge>
            {mode === "plan" && overdue > 0 ? (
              <StatusBadge tone="danger">Хэтэрсэн {overdue}</StatusBadge>
            ) : null}
            {mode === "plan" && noAction > 0 ? (
              <StatusBadge tone="warn">Төлөвлөгөөгүй {noAction}</StatusBadge>
            ) : null}
          </span>
        </button>
      </td>
    </tr>
  );
}

function PlanLeafRow({
  row,
  depth,
  onSelect,
}: {
  row: CorrectiveActionRow;
  depth: number;
  onSelect: (row: CorrectiveActionRow) => void;
}) {
  return (
    <tr>
      <td className="max-w-0 align-top">
        <div
          className="line-clamp-4 break-words font-medium"
          style={{ paddingLeft: `${depth * 1.1 + 1.4}rem` }}
        >
          {row.questionText}
        </div>
        <div
          className="mt-1 line-clamp-1 text-xs text-[var(--muted)]"
          style={{ paddingLeft: `${depth * 1.1 + 1.4}rem` }}
        >
          {row.findingTitle}
        </div>
      </td>
      <td className="align-top">
        <StatusBadge tone={riskTone(row.riskLabel)}>
          {labelOf(FINDING_RISK_LABELS, row.riskLabel)} · {row.riskScore}%
        </StatusBadge>
        <div className="mt-1 line-clamp-2 text-[11px] text-[var(--muted)]">
          {row.riskExplanation}
        </div>
      </td>
      <td className="max-w-0 align-top">
        <div className="line-clamp-3 break-words font-medium">{row.actionText}</div>
        {row.managerComment ? (
          <div className="mt-1 line-clamp-2 text-xs text-[var(--muted)]">
            {row.managerComment}
          </div>
        ) : null}
      </td>
      <td className="align-top text-xs tabular-nums">
        <div>Эхлэх: {row.startDate || "-"}</div>
        <div className="mt-1">Дуусах: {row.dueDate || "-"}</div>
        <div className="mt-1">
          <StatusBadge tone={row.dueTone}>{row.dueLabel}</StatusBadge>
        </div>
      </td>
      <td className="align-top text-xs">
        <StatusBadge tone={actionTone(row.actionStatus)}>
          {labelOf(ACTION_STATUS_LABELS, row.actionStatus)}
        </StatusBadge>
        <div className="mt-1 tabular-nums text-[var(--muted)]">
          Явц {row.progressPercent}%
        </div>
        <div className="mt-1 line-clamp-2 text-[var(--muted)]">
          {row.responsibleEmployeeId || row.responsibleOrgUnitId || "-"}
        </div>
      </td>
      <td className="align-top">
        <button
          type="button"
          className="btn whitespace-nowrap px-2 py-1 text-xs"
          onClick={() => onSelect(row)}
        >
          Дэлгэрэнгүй
        </button>
      </td>
    </tr>
  );
}

function ArchiveLeafRow({
  row,
  depth,
  onSelect,
  onDelete,
}: {
  row: CorrectiveActionRow;
  depth: number;
  onSelect?: (row: CorrectiveActionRow) => void;
  onDelete: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <tr>
      <td className="max-w-0 align-top">
        <div
          className="line-clamp-4 break-words font-medium"
          style={{ paddingLeft: `${depth * 1.1 + 1.4}rem` }}
        >
          {row.questionText}
        </div>
        <div
          className="mt-1 line-clamp-1 text-xs text-[var(--muted)]"
          style={{ paddingLeft: `${depth * 1.1 + 1.4}rem` }}
        >
          {row.findingTitle}
        </div>
      </td>
      <td className="align-top">
        <StatusBadge tone={riskTone(row.riskLabel)}>
          {labelOf(FINDING_RISK_LABELS, row.riskLabel)} · {row.riskScore}%
        </StatusBadge>
      </td>
      <td className="max-w-0 align-top">
        <div className="line-clamp-3 break-words">{row.actionText}</div>
      </td>
      <td className="align-top text-xs tabular-nums">
        {row.completedDate || row.dueDate || "-"}
      </td>
      <td className="align-top text-xs">
        {row.responsibleEmployeeId || row.responsibleOrgUnitId || "-"}
      </td>
      <td className="align-top">
        <div className="flex items-center gap-1">
          {onSelect ? (
            <button
              type="button"
              className="btn p-2"
              aria-label="Дэлгэрэнгүй харах"
              title="Дэлгэрэнгүй харах"
              onClick={() => onSelect(row)}
            >
              <Eye aria-hidden="true" className="h-4 w-4" />
            </button>
          ) : null}
          <form action={onDelete}>
            <input type="hidden" name="findingId" value={row.findingId} />
            <button
              type="submit"
              className="btn p-2 text-red-700 hover:bg-red-50"
              aria-label="Архиваас устгах"
              title="Архиваас устгах"
              onClick={(event) => {
                if (!window.confirm("Энэ архивын мөрийг устгах уу?")) {
                  event.preventDefault();
                }
              }}
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
            </button>
          </form>
        </div>
      </td>
    </tr>
  );
}

function renderNodes(
  nodes: Array<FolderNode | CorrectiveActionRow>,
  depth: number,
  expanded: Set<string>,
  toggle: (key: string) => void,
  mode: TreeMode,
  onSelect: ((row: CorrectiveActionRow) => void) | undefined,
  onDelete: ((formData: FormData) => void | Promise<void>) | undefined,
): ReactNode[] {
  const rows: ReactNode[] = [];
  const colSpan = 6;
  for (const node of nodes) {
    if (isFolder(node)) {
      const open = expanded.has(node.key);
      rows.push(
        <FolderRow
          key={node.key}
          folder={node}
          depth={depth}
          open={open}
          onToggle={() => toggle(node.key)}
          colSpan={colSpan}
          mode={mode}
        />,
      );
      if (open) {
        rows.push(
          ...renderNodes(
            node.children,
            depth + 1,
            expanded,
            toggle,
            mode,
            onSelect,
            onDelete,
          ),
        );
      }
    } else if (mode === "archive" && onDelete) {
      rows.push(
        <ArchiveLeafRow
          key={node.findingId}
          row={node}
          depth={depth}
          onSelect={onSelect}
          onDelete={onDelete}
        />,
      );
    } else if (onSelect) {
      rows.push(
        <PlanLeafRow
          key={node.findingId}
          row={node}
          depth={depth}
          onSelect={onSelect}
        />,
      );
    }
  }
  return rows;
}

export function ActionPlanTreeTable({
  rows,
  emptyMessage,
  mode = "plan",
  onSelect,
  onDelete,
  tableId,
}: {
  rows: CorrectiveActionRow[];
  emptyMessage: string;
  mode?: TreeMode;
  onSelect?: (row: CorrectiveActionRow) => void;
  onDelete?: (formData: FormData) => void | Promise<void>;
  tableId?: string;
}) {
  const roots = useMemo(() => buildTree(rows), [rows]);
  const allExpandableKeys = useMemo(
    () => collectExpandableKeys(roots),
    [roots],
  );
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [rootsEpoch, setRootsEpoch] = useState(roots);
  if (roots !== rootsEpoch) {
    setRootsEpoch(roots);
    setExpanded(new Set());
  }

  function toggle(key: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const resolvedTableId =
    tableId ?? (mode === "archive" ? "resolved-actions-table" : "actions-plan-table");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn px-2 py-1 text-xs"
          onClick={() => setExpanded(new Set(allExpandableKeys))}
        >
          Бүгдийг нээх
        </button>
        <button
          type="button"
          className="btn px-2 py-1 text-xs"
          onClick={() => setExpanded(new Set())}
        >
          Бүгдийг хураах
        </button>
        <span className="self-center text-xs text-[var(--muted)]">
          ХШ хуудас → хэсэг → бүртгэгдсэн зөрчил
        </span>
      </div>
      <TableScroll size="lg" maxHeightClass="max-h-[32rem]">
        <table id={resolvedTableId} className="table-fixed text-sm">
          <thead>
            {mode === "archive" ? (
              <tr>
                <th className="w-[32%]">ХШ хуудас / асуулт / зөрчил</th>
                <th className="w-[14%]">Эрсдэл</th>
                <th className="w-[24%]">Арга хэмжээ</th>
                <th className="w-[12%]">Дууссан</th>
                <th className="w-[12%]">Хариуцагч</th>
                <th className="w-[8%]">Үйлдэл</th>
              </tr>
            ) : (
              <tr>
                <th className="w-[28%]">ХШ хуудас / асуулт / зөрчил</th>
                <th className="w-[14%]">Эрсдэл</th>
                <th className="w-[22%]">Авах арга хэмжээ</th>
                <th className="w-[14%]">Хугацаа</th>
                <th className="w-[14%]">Явц / хариуцагч</th>
                <th className="w-[8%]">Засвар</th>
              </tr>
            )}
          </thead>
          <tbody>
            {roots.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 text-center text-sm text-[var(--muted)]"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              renderNodes(
                roots,
                0,
                expanded,
                toggle,
                mode,
                onSelect,
                onDelete,
              )
            )}
          </tbody>
        </table>
      </TableScroll>
    </div>
  );
}
