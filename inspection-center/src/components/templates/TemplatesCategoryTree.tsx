"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Folder, FolderOpen } from "lucide-react";
import { StatusBadge, TableScroll } from "@/components/ui/primitives";

export type TemplateListRow = {
  id: string;
  code: string;
  title: string;
  category: string;
  sourceSheetName: string;
  active: boolean;
  questionCount: number;
};

type FolderNode = {
  key: string;
  label: string;
  templates: TemplateListRow[];
};

function collectExpandableKeys(folders: FolderNode[]) {
  return folders.map((folder) => folder.key);
}

function buildFolders(rows: TemplateListRow[]): FolderNode[] {
  const byCategory = new Map<string, TemplateListRow[]>();
  for (const row of rows) {
    const key = row.category.trim() || "Ангилалгүй";
    const list = byCategory.get(key) ?? [];
    list.push(row);
    byCategory.set(key, list);
  }

  return [...byCategory.entries()]
    .map(([label, templates]) => ({
      key: `category-${label}`,
      label,
      templates: [...templates].sort((a, b) =>
        a.code.localeCompare(b.code, undefined, { numeric: true }),
      ),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "mn"));
}

function FolderRow({
  folder,
  open,
  onToggle,
}: {
  folder: FolderNode;
  open: boolean;
  onToggle: () => void;
}) {
  const activeCount = folder.templates.filter((row) => row.active).length;
  const Icon = open ? FolderOpen : Folder;
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <tr className="bg-slate-50/80">
      <td colSpan={6} className="align-middle">
        <button
          type="button"
          className="flex w-full items-center gap-2 py-0.5 text-left"
          onClick={onToggle}
          aria-expanded={open}
        >
          <Chevron size={14} className="shrink-0 text-[var(--muted)]" />
          <Icon size={14} className="shrink-0 text-[var(--brand)]" />
          <span className="min-w-0 text-sm font-semibold text-[var(--fg)]">
            {folder.label}
          </span>
          <span className="ml-auto flex shrink-0 flex-wrap items-center gap-1.5 text-xs">
            <StatusBadge tone="brand">
              {folder.templates.length} хуудас
            </StatusBadge>
            {activeCount > 0 ? (
              <StatusBadge tone="ok">Идэвхтэй {activeCount}</StatusBadge>
            ) : null}
          </span>
        </button>
      </td>
    </tr>
  );
}

function TemplateRow({
  row,
  onDelete,
}: {
  row: TemplateListRow;
  onDelete: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <tr>
      <td className="col-narrow-sm font-semibold tabular-nums">
        <Link
          href={`/templates/${row.id}`}
          className="pl-7 text-[var(--brand-dark)] hover:underline"
        >
          {row.code}
        </Link>
      </td>
      <td className="col-text-primary" title={row.title}>
        <Link
          href={`/templates/${row.id}`}
          className="cell-ellipsis pl-1 hover:underline"
        >
          {row.title}
        </Link>
      </td>
      <td className="col-narrow-sm tabular-nums text-sm">{row.questionCount}</td>
      <td
        className="col-narrow text-sm text-[var(--muted)]"
        title={row.sourceSheetName}
      >
        <span className="cell-ellipsis">{row.sourceSheetName}</span>
      </td>
      <td className="col-narrow">
        <StatusBadge tone={row.active ? "ok" : "neutral"}>
          {row.active ? "Идэвхтэй" : "Идэвхгүй"}
        </StatusBadge>
      </td>
      <td className="col-actions">
        <form action={onDelete}>
          <input type="hidden" name="id" value={row.id} />
          <button className="btn" type="submit">
            Устгах
          </button>
        </form>
      </td>
    </tr>
  );
}

export function TemplatesCategoryTree({
  rows,
  onDelete,
}: {
  rows: TemplateListRow[];
  onDelete: (formData: FormData) => void | Promise<void>;
}) {
  const folders = useMemo(() => buildFolders(rows), [rows]);
  const allExpandableKeys = useMemo(
    () => collectExpandableKeys(folders),
    [folders],
  );
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [foldersEpoch, setFoldersEpoch] = useState(folders);
  if (folders !== foldersEpoch) {
    setFoldersEpoch(folders);
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

  const body: ReactNode[] = [];
  for (const folder of folders) {
    const open = expanded.has(folder.key);
    body.push(
      <FolderRow
        key={folder.key}
        folder={folder}
        open={open}
        onToggle={() => toggle(folder.key)}
      />,
    );
    if (open) {
      for (const row of folder.templates) {
        body.push(
          <TemplateRow key={row.id} row={row} onDelete={onDelete} />,
        );
      }
    }
  }

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
          Ангилал → ХШ хуудас
        </span>
      </div>
      <TableScroll size="md" maxHeightClass="max-h-[36rem]">
        <table id="templates-table">
          <thead>
            <tr>
              <th className="col-narrow-sm">Код</th>
              <th className="col-text-primary">Гарчиг</th>
              <th className="col-narrow-sm">Асуулт</th>
              <th className="col-narrow">Эх хүснэгт</th>
              <th className="col-narrow">Төлөв</th>
              <th className="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            {folders.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-8 text-center text-sm text-[var(--muted)]"
                >
                  Хяналтын хуудас олдсонгүй.
                </td>
              </tr>
            ) : (
              body
            )}
          </tbody>
        </table>
      </TableScroll>
    </div>
  );
}
