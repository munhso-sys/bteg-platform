"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { BadgeCheck, FileText, Plus, X } from "lucide-react";
import type { InspectionPerformer } from "@/lib/types";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function MetaIconPopover({
  title,
  value,
  placeholder,
  completed,
  locked,
  icon,
  onChange,
}: {
  title: string;
  value: string;
  placeholder: string;
  completed: boolean;
  locked: boolean;
  icon: ReactNode;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const readOnly = completed || locked;

  useEffect(() => {
    if (!open || completed) return;
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, completed]);

  return (
    <div
      ref={rootRef}
      className="relative"
      onMouseEnter={() => {
        if (completed) setOpen(true);
      }}
      onMouseLeave={() => {
        if (completed) setOpen(false);
      }}
    >
      <button
        type="button"
        className={cx(
          "inline-flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--card)] text-[var(--fg)] hover:bg-[var(--surface-muted)]",
          open && "border-[var(--brand)]",
          completed &&
            value.trim() &&
            "border-emerald-500/60 text-emerald-700 dark:text-emerald-300",
        )}
        title={title}
        aria-label={title}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          if (!completed) setOpen((v) => !v);
        }}
      >
        {icon}
      </button>
      {open ? (
        <div
          id={panelId}
          className="absolute right-0 z-30 mt-1 w-72 rounded-md border border-[var(--border)] bg-[var(--card)] p-3 shadow-lg"
          role="dialog"
          aria-label={title}
        >
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
            {title}
            {completed ? " · лавлагаа" : ""}
          </div>
          {readOnly ? (
            <p className="max-h-40 overflow-auto whitespace-pre-wrap text-sm text-[var(--fg)]">
              {value.trim() || "—"}
            </p>
          ) : (
            <textarea
              className="textarea min-h-24 w-full text-sm"
              value={value}
              placeholder={placeholder}
              onChange={(event) => onChange(event.target.value)}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

export function RunInspectionMetaForm({
  performers,
  notes,
  confirmationText,
  status,
  locked,
  onPerformersChange,
  onNotesChange,
  onConfirmationChange,
}: {
  performers: InspectionPerformer[];
  notes: string;
  confirmationText: string;
  status: string;
  locked: boolean;
  onPerformersChange: (rows: InspectionPerformer[]) => void;
  onNotesChange: (value: string) => void;
  onConfirmationChange: (value: string) => void;
}) {
  const completed = status === "completed";
  const rows =
    performers.length > 0
      ? performers
      : [{ place: "", name: "", position: "" }];

  function setRow(index: number, patch: Partial<InspectionPerformer>) {
    onPerformersChange(
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  return (
    <section className="mt-4 space-y-3 rounded-md border border-[var(--border)] bg-[var(--card)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">Хяналт шалгалт хийсэн</div>
          <p className="text-xs text-[var(--muted)]">
            Байгууллага, албан тушаал, нэр · баталгаажуулалт / тэмдэглэлийг
            icon-оор нэмнэ
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <MetaIconPopover
            title="Баталгаажуулалт"
            value={confirmationText}
            placeholder="Баталгаажуулсан ажилтан, огноо гэх мэт…"
            completed={completed}
            locked={locked}
            icon={<BadgeCheck size={16} />}
            onChange={onConfirmationChange}
          />
          <MetaIconPopover
            title="Тэмдэглэл"
            value={notes}
            placeholder="Нэмэлт тэмдэглэл…"
            completed={completed}
            locked={locked}
            icon={<FileText size={16} />}
            onChange={onNotesChange}
          />
          {!completed && !locked ? (
            <button
              type="button"
              className="inline-flex h-9 items-center gap-1 rounded-md border border-[var(--border)] px-2 text-xs font-medium hover:bg-[var(--surface-muted)]"
              onClick={() =>
                onPerformersChange([
                  ...rows,
                  { place: "", name: "", position: "" },
                ])
              }
            >
              <Plus size={14} />
              Мөр нэмэх
            </button>
          ) : null}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs text-[var(--muted)]">
              <th className="border border-[var(--border)] px-2 py-1.5 font-medium">
                Байгууллага
              </th>
              <th className="border border-[var(--border)] px-2 py-1.5 font-medium">
                Албан тушаал
              </th>
              <th className="border border-[var(--border)] px-2 py-1.5 font-medium">
                Нэр
              </th>
              <th className="w-10 border border-[var(--border)] px-1 py-1.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={`perf-${index}`}>
                <td className="border border-[var(--border)] px-1 py-1">
                  <input
                    className="input w-full border-0 bg-transparent text-sm"
                    value={row.place ?? ""}
                    disabled={locked || completed}
                    placeholder="Байгууллага"
                    onChange={(event) =>
                      setRow(index, { place: event.target.value })
                    }
                  />
                </td>
                <td className="border border-[var(--border)] px-1 py-1">
                  <input
                    className="input w-full border-0 bg-transparent text-sm"
                    value={row.position}
                    disabled={locked || completed}
                    placeholder="Албан тушаал"
                    onChange={(event) =>
                      setRow(index, { position: event.target.value })
                    }
                  />
                </td>
                <td className="border border-[var(--border)] px-1 py-1">
                  <input
                    className="input w-full border-0 bg-transparent text-sm"
                    value={row.name}
                    disabled={locked || completed}
                    placeholder="Нэр"
                    onChange={(event) =>
                      setRow(index, { name: event.target.value })
                    }
                  />
                </td>
                <td className="border border-[var(--border)] px-1 py-1 text-center">
                  {!completed && !locked && rows.length > 1 ? (
                    <button
                      type="button"
                      className="inline-flex rounded p-1 text-rose-600 hover:bg-[var(--surface-muted)]"
                      title="Устгах"
                      aria-label="Устгах"
                      onClick={() =>
                        onPerformersChange(rows.filter((_, i) => i !== index))
                      }
                    >
                      <X size={14} />
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
