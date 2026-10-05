"use client";

import { useMemo, useState } from "react";
import { ActionPlanTreeTable } from "@/components/actions/ActionPlanTreeTable";
import {
  FINDING_RISK_LABELS,
  type CorrectiveActionRow,
} from "@/components/actions/types";
import { Panel, StatusBadge } from "@/components/ui/primitives";
import {
  ACTION_STATUS_LABELS,
  FINDING_STATUS_LABELS,
  SEVERITY_LABELS,
  labelOf,
} from "@/lib/types";

function includes(value: string, query: string) {
  return value.toLowerCase().includes(query.toLowerCase().trim());
}

export function ResolvedActionsClient({
  resolvedRows,
  deleteResolvedRow,
  readOnly = false,
}: {
  resolvedRows: CorrectiveActionRow[];
  deleteResolvedRow: (formData: FormData) => void | Promise<void>;
  readOnly?: boolean;
}) {
  const [archiveQuery, setArchiveQuery] = useState("");
  const [archiveDetail, setArchiveDetail] = useState<CorrectiveActionRow | null>(
    null,
  );

  const filteredResolved = useMemo(
    () =>
      resolvedRows.filter((row) => {
        if (!archiveQuery.trim()) return true;
        return (
          includes(row.questionText, archiveQuery) ||
          includes(row.actionText, archiveQuery) ||
          includes(row.runTitle, archiveQuery) ||
          includes(row.responsibleEmployeeId, archiveQuery) ||
          includes(row.responsibleOrgUnitId, archiveQuery)
        );
      }),
    [archiveQuery, resolvedRows],
  );

  return (
    <div className="space-y-4">
      <Panel title="Арилсан зөрчлийн архив">
        <div className="mb-3 max-w-md">
          <input
            className="input"
            placeholder="Асуулт, арга хэмжээ, хариуцагчаар хайх"
            value={archiveQuery}
            onChange={(event) => setArchiveQuery(event.target.value)}
          />
        </div>
        <ActionPlanTreeTable
          mode="archive"
          rows={filteredResolved}
          emptyMessage="Арилсан зөрчил олдсонгүй."
          onSelect={setArchiveDetail}
          onDelete={readOnly ? undefined : deleteResolvedRow}
        />
      </Panel>

      {archiveDetail ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-md bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-[var(--border)] px-4 py-3">
              <div>
                <h2 className="text-base font-semibold">
                  Арилсан зөрчлийн дэлгэрэнгүй
                </h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {archiveDetail.questionText}
                </p>
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => setArchiveDetail(null)}
              >
                Хаах
              </button>
            </div>
            <div className="grid gap-4 p-4 text-sm">
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Хяналт шалгалт
                </h3>
                <dl className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-[var(--muted)]">ХШ-ын нэр</dt>
                    <dd className="font-medium">
                      {archiveDetail.runTitle || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">ХШ төрөл</dt>
                    <dd className="font-medium">
                      {archiveDetail.inspectionTypeLabel || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">ХШ хуудас</dt>
                    <dd className="font-medium">
                      {archiveDetail.checklistTitle || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">
                      ХШ хийсэн огноо
                    </dt>
                    <dd className="font-medium tabular-nums">
                      {archiveDetail.inspectionDate || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">Байгууллага</dt>
                    <dd className="font-medium">
                      {archiveDetail.inspectedByOrg || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">Хэсэг / хэлтэс</dt>
                    <dd className="font-medium">
                      {archiveDetail.sectionTitle ||
                        archiveDetail.targetDepartmentId ||
                        archiveDetail.targetOrgUnitId ||
                        "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">Алба / нэгж</dt>
                    <dd className="font-medium">
                      {archiveDetail.targetOrgUnitId ||
                        archiveDetail.responsibleOrgUnitId ||
                        "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">
                      ХШ эхэлсэн / дууссан
                    </dt>
                    <dd className="font-medium tabular-nums">
                      {(archiveDetail.inspectionDate || "—") +
                        " → " +
                        (archiveDetail.runCompletedDate ||
                          archiveDetail.runDueDate ||
                          "—")}
                    </dd>
                  </div>
                </dl>
                <div>
                  <div className="mb-1 text-xs text-[var(--muted)]">
                    Хяналт шалгалт хийсэн (байгууллага / албан тушаал / нэр)
                  </div>
                  {archiveDetail.performers.length > 0 ? (
                    <ul className="space-y-1 rounded border border-[var(--border)] bg-slate-50 px-3 py-2 text-sm">
                      {archiveDetail.performers.map((person, index) => (
                        <li key={`${person.place}-${person.name}-${index}`}>
                          {person.place ? (
                            <span className="font-medium">{person.place}</span>
                          ) : null}
                          {person.place && (person.position || person.name)
                            ? " · "
                            : null}
                          {person.position ? (
                            <span className="text-[var(--muted)]">
                              {person.position}
                            </span>
                          ) : null}
                          {person.position && person.name ? " — " : null}
                          <span className="font-medium">
                            {person.name ||
                              (!person.place && !person.position ? "—" : "")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-[var(--muted)]">Бүртгээгүй</div>
                  )}
                </div>
              </section>

              <section className="space-y-2 border-t border-[var(--border)] pt-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Зөрчил / үл тохирол
                </h3>
                <dl className="grid gap-2 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-[var(--muted)]">
                      Асуулт / зөрчил
                    </dt>
                    <dd className="font-medium">{archiveDetail.questionText}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-[var(--muted)]">Гарчиг</dt>
                    <dd>{archiveDetail.findingTitle || "—"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-[var(--muted)]">Тайлбар</dt>
                    <dd>{archiveDetail.findingDescription || "—"}</dd>
                  </div>
                  {archiveDetail.findingSourceText ? (
                    <div className="sm:col-span-2">
                      <dt className="text-xs text-[var(--muted)]">Эх сурвалж</dt>
                      <dd>{archiveDetail.findingSourceText}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-xs text-[var(--muted)]">Төлөв</dt>
                    <dd>
                      {labelOf(FINDING_STATUS_LABELS, archiveDetail.findingStatus)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">Ноцтол</dt>
                    <dd>{labelOf(SEVERITY_LABELS, archiveDetail.severity)}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-[var(--muted)]">Эрсдэл</dt>
                    <dd>
                      <StatusBadge
                        tone={
                          archiveDetail.riskLabel === "critical" ||
                          archiveDetail.riskLabel === "high"
                            ? "danger"
                            : archiveDetail.riskLabel === "medium"
                              ? "warn"
                              : "neutral"
                        }
                      >
                        {labelOf(FINDING_RISK_LABELS, archiveDetail.riskLabel)} ·{" "}
                        {archiveDetail.riskScore}%
                      </StatusBadge>
                      <div className="mt-1 text-xs text-[var(--muted)]">
                        {archiveDetail.riskExplanation || "—"}
                      </div>
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="space-y-2 border-t border-[var(--border)] pt-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Засах арга хэмжээ
                </h3>
                <dl className="grid gap-2 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-[var(--muted)]">Арга хэмжээ</dt>
                    <dd className="font-medium">
                      {archiveDetail.actionText || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">
                      Хариуцсан ажилтан
                    </dt>
                    <dd>{archiveDetail.responsibleEmployeeId || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">Албан тушаал</dt>
                    <dd>{archiveDetail.responsibleJobPositionId || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">Хариуцсан нэгж</dt>
                    <dd>{archiveDetail.responsibleOrgUnitId || "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">
                      Гүйцэтгэлийн төлөв
                    </dt>
                    <dd>
                      {labelOf(ACTION_STATUS_LABELS, archiveDetail.actionStatus)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">Эхэлсэн огноо</dt>
                    <dd className="tabular-nums">
                      {archiveDetail.startDate || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">Дууссан огноо</dt>
                    <dd className="tabular-nums">
                      {archiveDetail.completedDate ||
                        archiveDetail.dueDate ||
                        "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">Явц</dt>
                    <dd className="tabular-nums">
                      {archiveDetail.progressPercent}%
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--muted)]">Хугацааны төлөв</dt>
                    <dd>{archiveDetail.dueLabel || "—"}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs text-[var(--muted)]">
                      Явцын мэдээлэл / засварын тэмдэглэл
                    </dt>
                    <dd className="whitespace-pre-wrap rounded border border-[var(--border)] bg-slate-50 px-3 py-2">
                      {archiveDetail.managerComment || "—"}
                    </dd>
                  </div>
                </dl>
              </section>

              <div className="flex justify-end border-t border-[var(--border)] pt-3">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setArchiveDetail(null)}
                >
                  Хаах
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
