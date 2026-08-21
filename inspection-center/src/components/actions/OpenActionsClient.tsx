"use client";

import { useMemo, useState } from "react";
import { ActionPlanTreeTable } from "@/components/actions/ActionPlanTreeTable";
import { FINDING_RISK_LABELS, type CorrectiveActionRow } from "@/components/actions/types";
import { Panel } from "@/components/ui/primitives";
import { ACTION_STATUS_LABELS, SEVERITY_LABELS, labelOf } from "@/lib/types";

export function OpenActionsClient({
  rows,
  severityOptions,
  statusOptions,
  typeOptions,
  updateAction,
  readOnly = false,
}: {
  rows: CorrectiveActionRow[];
  severityOptions: string[];
  statusOptions: string[];
  typeOptions: Array<{ value: string; label: string }>;
  updateAction: (formData: FormData) => void | Promise<void>;
  readOnly?: boolean;
}) {
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [selected, setSelected] = useState<CorrectiveActionRow | null>(null);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (severity !== "all" && row.severity !== severity) return false;
        if (status !== "all" && row.actionStatus !== status) return false;
        if (type !== "all" && row.inspectionTypeLabel !== type) return false;
        return true;
      }),
    [rows, severity, status, type],
  );

  return (
    <div className="space-y-4">
      <Panel title="Шүүлтүүр">
        <div className="grid gap-2 md:grid-cols-4">
          <label className="text-xs font-medium text-[var(--muted)]">
            Эрсдэл
            <select
              className="select mt-1"
              value={severity}
              onChange={(event) => setSeverity(event.target.value)}
            >
              <option value="all">Бүгд</option>
              {severityOptions.map((item) => (
                <option key={item} value={item}>
                  {labelOf(SEVERITY_LABELS, item)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-[var(--muted)]">
            Арга хэмжээний төлөв
            <select
              className="select mt-1"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="all">Бүгд</option>
              {statusOptions.map((item) => (
                <option key={item} value={item}>
                  {labelOf(ACTION_STATUS_LABELS, item)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-[var(--muted)]">
            ХШ төрөл
            <select
              className="select mt-1"
              value={type}
              onChange={(event) => setType(event.target.value)}
            >
              <option value="all">Бүгд</option>
              {typeOptions.map((item) => (
                <option key={item.value} value={item.label}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div className="self-end text-xs text-[var(--muted)]">
            Илэрц: {filteredRows.length}
          </div>
        </div>
      </Panel>

      <Panel title="Арилаагүй зөрчил ба арга хэмжээний төлөвлөгөө">
        <ActionPlanTreeTable
          rows={filteredRows}
          emptyMessage="Сонгосон шүүлтүүрт арилаагүй зөрчил алга."
          onSelect={setSelected}
        />
      </Panel>

      {selected ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-md bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-[var(--border)] px-4 py-3">
              <div>
                <h2 className="text-base font-semibold">
                  Засах арга хэмжээний дэлгэрэнгүй
                </h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {selected.questionText}
                </p>
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => setSelected(null)}
              >
                Хаах
              </button>
            </div>
            <form
              action={readOnly ? undefined : updateAction}
              className="grid gap-3 p-4"
              onSubmit={readOnly ? (e) => e.preventDefault() : undefined}
            >
              <fieldset disabled={readOnly} className="contents">
              <input type="hidden" name="id" value={selected.actionId ?? ""} />
              <input type="hidden" name="findingId" value={selected.findingId} />
              <label className="text-xs font-medium text-[var(--muted)]">
                Авах арга хэмжээний төлөвлөгөө
                <textarea
                  className="textarea mt-1"
                  name="actionText"
                  defaultValue={selected.actionText}
                />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="text-xs font-medium text-[var(--muted)]">
                  Хариуцагч ажилтан
                  <input
                    className="input mt-1"
                    name="responsibleEmployeeId"
                    defaultValue={selected.responsibleEmployeeId}
                  />
                </label>
                <label className="text-xs font-medium text-[var(--muted)]">
                  Хариуцагч нэгж
                  <input
                    className="input mt-1"
                    name="responsibleOrgUnitId"
                    defaultValue={selected.responsibleOrgUnitId}
                  />
                </label>
                <label className="text-xs font-medium text-[var(--muted)]">
                  Эхлэх огноо
                  <input
                    className="input mt-1"
                    name="startDate"
                    type="date"
                    defaultValue={selected.startDate}
                  />
                </label>
                <label className="text-xs font-medium text-[var(--muted)]">
                  Дуусах огноо
                  <input
                    className="input mt-1"
                    name="dueDate"
                    type="date"
                    defaultValue={selected.dueDate}
                  />
                </label>
                <label className="text-xs font-medium text-[var(--muted)]">
                  Явц %
                  <input
                    className="input mt-1"
                    name="progressPercent"
                    type="number"
                    min="0"
                    max="100"
                    defaultValue={selected.progressPercent}
                  />
                </label>
                <label className="text-xs font-medium text-[var(--muted)]">
                  Төлөв
                  <select
                    className="select mt-1"
                    name="status"
                    defaultValue={
                      selected.actionStatus === "no_action" ||
                      selected.actionStatus === "overdue"
                        ? "assigned"
                        : selected.actionStatus
                    }
                  >
                    <option value="assigned">
                      {ACTION_STATUS_LABELS.assigned}
                    </option>
                    <option value="in_progress">
                      {ACTION_STATUS_LABELS.in_progress}
                    </option>
                    <option value="submitted">
                      {ACTION_STATUS_LABELS.submitted}
                    </option>
                    <option value="verified">
                      {ACTION_STATUS_LABELS.verified}
                    </option>
                    <option value="closed">{ACTION_STATUS_LABELS.closed}</option>
                  </select>
                </label>
              </div>
              <label className="text-xs font-medium text-[var(--muted)]">
                Явцын мэдээлэл / засварын тэмдэглэл
                <textarea
                  className="textarea mt-1"
                  name="managerComment"
                  defaultValue={selected.managerComment}
                />
              </label>
              </fieldset>
              <div className="rounded-md border border-[var(--border)] bg-slate-50 p-3 text-xs text-[var(--muted)]">
                <div>
                  Эрсдэл: {labelOf(FINDING_RISK_LABELS, selected.riskLabel)} ·{" "}
                  {selected.riskScore}%
                </div>
                <div>{selected.riskExplanation}</div>
                <div>Хугацаа: {selected.dueLabel}</div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setSelected(null)}
                >
                  {readOnly ? "Хаах" : "Болих"}
                </button>
                {!readOnly ? (
                  <button type="submit" className="btn btn-primary">
                    Хадгалах
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
