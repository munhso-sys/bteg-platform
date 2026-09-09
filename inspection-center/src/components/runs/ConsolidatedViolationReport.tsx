"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Panel, TableScroll } from "@/components/ui/primitives";
import {
  ConsolidatedReportPdfButton,
  ConsolidatedReportWordButton,
} from "@/components/ui/ExportButtons";
import { ShareConsolidatedReportDialog } from "@/components/runs/ShareConsolidatedReportDialog";
import { buildConsolidatedViolationReport } from "@/lib/runs/consolidated-report";
import type {
  InspectionAnswer,
  InspectionPerformer,
  InspectionTemplateQuestion,
  JointUnitScope,
} from "@/lib/types";

type Row = {
  answer: InspectionAnswer;
  question: InspectionTemplateQuestion | undefined;
};

type UnitOption = {
  key: string;
  label: string;
};

type PreviewPhoto = {
  url: string;
  name: string;
};

export function ConsolidatedViolationReport({
  runId,
  runTitle,
  inspectionDate,
  inspectedByOrg,
  performers = [],
  scopes,
  rows,
  units,
  inspectionType,
}: {
  runId: string;
  runTitle: string;
  inspectionDate: string;
  inspectedByOrg?: string;
  performers?: InspectionPerformer[];
  scopes: JointUnitScope[];
  rows: Row[];
  units: UnitOption[];
  inspectionType?: "JOINT_INSPECTION" | "NIGHT_INSPECTION";
}) {
  const [preview, setPreview] = useState<PreviewPhoto | null>(null);
  const report = useMemo(
    () =>
      buildConsolidatedViolationReport({
        scopes,
        rows,
        allUnitLabels: units,
      }),
    [scopes, rows, units],
  );

  const filledPerformers = performers.filter(
    (row) => row.name.trim() || row.position.trim(),
  );

  const isNight = inspectionType === "NIGHT_INSPECTION";
  const reportTitle = isNight ? "Шөнийн ХШ — үл тохирлын тайлан" : "Хамтарсан ХШ — үл тохирлын тайлан";
  const mainHeading = isNight ? "Шөнийн хяналт шалгалтын тайлан" : "Хамтарсан хяналт шалгалтын тайлан";
  const reportSubtitle = isNight ? "Ажлын байрны шөнийн хяналт шалгалтын хуудас" : "Ажлын байрны хамтарсан хяналт шалгалтын хуудас";
  const checkingTeam = isNight ? "ДХШХ" : "ДХШХ, БОХ, ХАБЭАХ";
  const reportLabel = isNight ? "Шөнийн ХШ" : "Хамтарсан ХШ";

  const unitSummaryRows = report.byUnit.filter(
    (row) => row.violationCount > 0 || row.failedScore > 0,
  );

  return (
    <div
      id={`consolidated-report-${runId}`}
      className="consolidated-report space-y-4"
    >
      <Panel
        title={reportTitle}
        actions={
          <div className="flex flex-wrap gap-2">
            <ConsolidatedReportWordButton
              disabled={report.savedUnitCount === 0}
              report={report}
              runTitle={runTitle}
              inspectionDate={inspectionDate}
              inspectedByOrg={inspectedByOrg}
              performers={filledPerformers}
              filename={`ul-tohirol-${runId.slice(0, 8)}`}
              inspectionType={inspectionType}
            />
            <ConsolidatedReportPdfButton
              disabled={report.savedUnitCount === 0}
              label="Үл тохирлын тайлан PDF"
              report={report}
              runTitle={runTitle}
              inspectionDate={inspectionDate}
              inspectedByOrg={inspectedByOrg}
              performers={filledPerformers}
              inspectionType={inspectionType}
            />
            <ShareConsolidatedReportDialog
              disabled={report.savedUnitCount === 0}
              report={report}
              runTitle={runTitle}
              inspectionDate={inspectionDate}
              inspectedByOrg={inspectedByOrg}
              performers={filledPerformers}
              inspectionType={inspectionType}
              filename={`ul-tohirol-${runId.slice(0, 8)}`}
            />
          </div>
        }
      >
        {report.savedUnitCount === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            Тайлан гаргахын тулд дор хаяж нэг хэсгийг бөглөж хадгална уу.
          </p>
        ) : (
          <div className="consolidated-report-body max-h-[min(70vh,52rem)] overflow-auto overscroll-contain rounded border border-[var(--border)] bg-white">
            <div className="min-w-[72rem] space-y-4 p-3">
            <header className="overflow-x-auto overscroll-x-contain border border-[var(--border)] bg-white p-3 text-sm">
              <div className="min-w-[40rem] space-y-3">
              <div className="text-center">
                <div className="text-base font-semibold tracking-tight">
                  {mainHeading}
                </div>
                <div className="text-[11px] text-[var(--muted)]">
                  Work Place Inspection Report Form
                </div>
                <div className="text-[11px] text-[var(--muted)]">
                  {reportSubtitle}
                </div>
                <div className="mt-2 border-t border-[var(--border)] pt-2 text-left text-xs">
                  <div className="mb-1 font-semibold">
                    ХШ гүйцэтгэсэн ажилтан
                  </div>
                  {filledPerformers.length > 0 ? (
                    <div className="leading-relaxed">
                      {filledPerformers
                        .map((person) => {
                          const name = person.name.trim() || "—";
                          const position = person.position.trim();
                          return position ? `${name} (${position})` : name;
                        })
                        .join(" · ")}
                    </div>
                  ) : (
                    <div className="text-[var(--muted)]">
                      Нэр, албан тушаал бүртгээгүй
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-2 border-t border-[var(--border)] pt-2 text-xs md:grid-cols-3">
                <div>
                  <div className="font-semibold">Байгууллага</div>
                  <div>{inspectedByOrg || "“Болдтөмөр Ерөө гол” ХХК"}</div>
                </div>
                <div>
                  <div className="font-semibold">Шалгах баг</div>
                  <div>{checkingTeam}</div>
                </div>
                <div>
                  <div className="font-semibold">Огноо</div>
                  <div>{inspectionDate}</div>
                </div>
              </div>

              <div className="text-xs leading-relaxed">
                <span className="font-semibold">
                  Inspection place / Шалгалт хийсэн хэлтэс, алба:{" "}
                </span>
                <span>
                  {report.inspectedUnits.length > 0
                    ? report.inspectedUnits
                        .map((unit, index) => `${index + 1}. ${unit}`)
                        .join(", ")
                    : "—"}
                </span>
                <div className="mt-2 text-[var(--muted)]">Гарчиг: {runTitle}</div>
              </div>
              </div>
            </header>

            <div className="grid gap-4 print:hidden lg:grid-cols-[minmax(0,22rem)_1fr]">
              <div className="rounded-md border border-[var(--border)] p-2.5">
                <div className="mb-1.5 text-xs font-semibold">Хэсгээр зөрчил</div>
                {unitSummaryRows.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    Зөрчилтэй хэсэг алга
                  </p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-left text-[var(--muted)]">
                        <th className="py-1.5 pr-2 font-medium">Хэсэг</th>
                        <th className="py-1.5 pr-2 text-right font-medium">
                          Зөрчил
                        </th>
                        <th className="py-1.5 text-right font-medium">
                          Онооны %
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {unitSummaryRows.map((row) => (
                        <tr
                          key={row.key}
                          className="border-b border-[var(--border)] last:border-0"
                        >
                          <td className="py-1.5 pr-2 font-semibold">
                            {row.label}
                          </td>
                          <td className="py-1.5 pr-2 text-right tabular-nums font-semibold">
                            {row.violationCount}
                          </td>
                          <td className="py-1.5 text-right tabular-nums font-semibold">
                            {row.scoreSharePercent}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p className="mt-2 text-[10px] text-[var(--muted)]">
                  Онооны % = зөрчлийн оноо ÷ нийт батлагдсан оноо × 100
                </p>
              </div>
              <div className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-sm text-[var(--fg)]">
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--brand-dark)]">
                  Товч дүгнэлт
                </div>
                <p className="leading-relaxed text-[var(--fg)]">{report.aiConclusion}</p>
              </div>
            </div>

            <div className="text-sm font-semibold uppercase tracking-wide">
              Non-STANDARD CONDITIONS / СТАНДАРТ БУС НӨХЦӨЛ / ҮЙЛДЭЛ
            </div>

            {report.byCategory.length === 0 ? (
              <p className="text-sm text-[var(--muted)]">
                Зөрчил / үл тохирол бүртгэгдээгүй.
              </p>
            ) : (
              report.byCategory.map((section) => (
                <div key={section.category} className="space-y-2">
                  <div className="rounded bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white">
                    {section.category}
                  </div>
                  <TableScroll
                    size="lg"
                    maxHeightClass="max-h-none"
                  >
                    <table className="min-w-[70rem] text-[11px]">
                      <thead>
                        <tr>
                          <th className="w-[6%]">
                            Hazard Class
                            <br />
                            Аюулын зэрэг
                          </th>
                          <th className="w-[10%]">
                            Department
                            <br />
                            Хэлтэс, алба
                          </th>
                          <th className="w-[22%]">
                            Disagreement
                            <br />
                            Зөрчил, үл тохирол
                          </th>
                          <th className="w-[12%]">
                            Picture
                            <br />
                            Зураг
                          </th>
                          <th className="w-[18%]">
                            Action Required
                            <br />
                            Шаардлагатай авсан арга хэмжээ
                          </th>
                          <th className="w-[12%]">
                            Responsible person
                            <br />
                            Хариуцсан хүн
                          </th>
                          <th className="w-[10%]">
                            Targeted Date
                            <br />
                            Дуусах хугацаа
                          </th>
                          <th className="w-[10%]">
                            Performance
                            <br />
                            Гүйцэтгэлийн зураг
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.items.map((item) => (
                          <tr key={item.id}>
                            <td className="align-top text-center text-sm font-bold">
                              {item.hazardClass}
                            </td>
                            <td className="align-top font-medium">
                              {item.department}
                            </td>
                            <td className="align-top leading-snug">
                              <div>{item.disagreement}</div>
                              <div className="mt-1 text-[10px] text-[var(--muted)]">
                                №{item.questionNo}
                              </div>
                            </td>
                            <td className="align-top">
                              {item.photoUrl ? (
                                <span
                                  role="button"
                                  tabIndex={0}
                                  className="inline-block cursor-zoom-in rounded border border-[var(--border)] outline-none ring-[var(--brand)] focus-visible:ring-2 print:border-0"
                                  title="Томруулж харах"
                                  onClick={() =>
                                    setPreview({
                                      url: item.photoUrl!,
                                      name:
                                        item.photoName ||
                                        item.department ||
                                        "Зураг",
                                    })
                                  }
                                  onKeyDown={(event) => {
                                    if (
                                      event.key === "Enter" ||
                                      event.key === " "
                                    ) {
                                      event.preventDefault();
                                      setPreview({
                                        url: item.photoUrl!,
                                        name:
                                          item.photoName ||
                                          item.department ||
                                          "Зураг",
                                      });
                                    }
                                  }}
                                >
                                  <img
                                    src={item.photoUrl}
                                    alt={item.photoName || item.department}
                                    className="h-16 w-20 object-cover print:h-24 print:w-28"
                                  />
                                </span>
                              ) : (
                                <span className="text-[var(--muted)]">—</span>
                              )}
                            </td>
                            <td className="align-top leading-snug">
                              {item.actionRequired}
                            </td>
                            <td className="align-top">
                              {item.responsiblePerson || "—"}
                            </td>
                            <td className="align-top tabular-nums">
                              {item.targetDate || "—"}
                            </td>
                            <td className="align-top text-[var(--muted)]">—</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableScroll>
                </div>
              ))
            )}

            <div className="rounded-md border border-[var(--border)] bg-slate-50 p-3 text-[11px] text-[var(--muted)]">
              Аюулын зэрэг: A зэрэг (Үлэмж — нэн даруй хийх), B зэрэг (ноцтой),
              C зэрэг (дунд), D зэрэг (жижиг)
            </div>
            </div>
          </div>
        )}
      </Panel>

      {preview ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/70 p-4 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Зураг томруулж харах"
          onClick={() => setPreview(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[min(96vw,56rem)] overflow-auto rounded-md bg-white p-3 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0 text-sm font-medium">{preview.name}</div>
              <button
                type="button"
                className="btn shrink-0 p-1.5"
                aria-label="Хаах"
                title="Хаах"
                onClick={() => setPreview(null)}
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
            <img
              src={preview.url}
              alt={preview.name}
              className="max-h-[80vh] w-auto max-w-full rounded object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
