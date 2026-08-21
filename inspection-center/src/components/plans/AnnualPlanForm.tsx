"use client";

import { useMemo, useState } from "react";
import type {
  AnnualPlanMetric,
  InspectionTemplate,
  InspectionType,
} from "@/lib/types";
import { INSPECTION_TYPE_LABELS } from "@/lib/types";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

const METRIC_OPTIONS: Array<{ value: AnnualPlanMetric; label: string }> = [
  { value: "planned", label: "Төлөвлөгөөт" },
  { value: "unplanned", label: "Төлөвлөгөөт бус" },
  { value: "completed", label: "Гүйцэтгэл" },
];

const TYPE_OPTIONS: InspectionType[] = [
  "STATE_INSPECTION",
  "CHECKLIST",
  "NIGHT_INSPECTION",
  "JOINT_INSPECTION",
  "DOCUMENT_INSPECTION",
  "UNPLANNED_INSPECTION",
];

export function AnnualPlanForm({
  action,
  templates,
}: {
  action: (formData: FormData) => void | Promise<void>;
  templates: InspectionTemplate[];
}) {
  const [inspectionType, setInspectionType] =
    useState<InspectionType>("STATE_INSPECTION");

  const templateOptions = useMemo(
    () => {
      const activeTemplates = templates.filter((template) => template.active);
      const typeSpecificLabels: InspectionType[] = [
        "NIGHT_INSPECTION",
        "JOINT_INSPECTION",
        "UNPLANNED_INSPECTION",
      ];
      const filtered = typeSpecificLabels.includes(inspectionType)
        ? activeTemplates.filter((template) => {
            const label = INSPECTION_TYPE_LABELS[inspectionType];
            return template.category === label || template.title === label;
          })
        : activeTemplates;

      return filtered.sort((a, b) =>
        a.code.localeCompare(b.code, undefined, { numeric: true }),
      );
    },
    [inspectionType, templates],
  );
  const usesTemplate =
    inspectionType === "STATE_INSPECTION" ||
    inspectionType === "CHECKLIST" ||
    inspectionType === "NIGHT_INSPECTION" ||
    inspectionType === "JOINT_INSPECTION" ||
    inspectionType === "UNPLANNED_INSPECTION";

  return (
    <form action={action} className="grid gap-2" autoComplete="off">
      <select
        className="select"
        name="inspectionType"
        value={inspectionType}
        onChange={(event) =>
          setInspectionType(event.target.value as InspectionType)
        }
      >
        {TYPE_OPTIONS.map((value) => (
          <option key={value} value={value}>
            {INSPECTION_TYPE_LABELS[value]}
          </option>
        ))}
      </select>

      <select
        className="select"
        name="templateId"
        required={usesTemplate}
        defaultValue=""
      >
        <option value="" disabled={usesTemplate}>
          ХШ хуудас сонгох...
        </option>
        {templateOptions.map((template) => (
          <option key={template.id} value={template.id}>
            {template.code} - {template.title}
          </option>
        ))}
      </select>

      {!usesTemplate ? (
        <input
          className="input"
          name="checklistName"
          placeholder="ХШ-ийн форм / төлөвлөгөөний нэр"
          defaultValue={INSPECTION_TYPE_LABELS[inspectionType]}
          autoComplete="off"
          required
        />
      ) : null}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <select className="select" name="metric" defaultValue="planned">
          {METRIC_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <input
          className="input"
          name="year"
          type="number"
          defaultValue={2026}
        />
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <select className="select" name="month" defaultValue="1">
          {MONTHS.map((month) => (
            <option key={month} value={month}>
              {month}-р сар
            </option>
          ))}
        </select>
        <input
          className="input"
          name="count"
          type="number"
          min="0"
          defaultValue="1"
        />
        <input className="input" name="detailDate" type="date" />
      </div>

      <button className="btn btn-primary w-full sm:w-auto" type="submit">
        Нэмэх
      </button>
    </form>
  );
}
