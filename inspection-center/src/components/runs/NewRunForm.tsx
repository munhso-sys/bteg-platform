"use client";

import { useMemo, useState } from "react";
import type {
  AnnualPlanMetric,
  AnnualPlanRow,
  InspectionRun,
  InspectionTemplate,
  InspectionType,
} from "@/lib/types";
import {
  INSPECTION_RUN_SAVE_STATUS_OPTIONS,
  INSPECTION_TYPE_LABELS,
} from "@/lib/types";

const PLAN_METRIC_OPTIONS: Array<{ value: AnnualPlanMetric; label: string }> = [
  { value: "planned", label: "Төлөвлөгөөт" },
  { value: "unplanned", label: "Төлөвлөгөөт бус" },
  { value: "completed", label: "Гүйцэтгэл" },
  { value: "as_needed", label: "Тухай бүр" },
];

const TYPE_OPTIONS: InspectionType[] = [
  "CHECKLIST",
  "STATE_INSPECTION",
  "NIGHT_INSPECTION",
  "JOINT_INSPECTION",
  "DOCUMENT_INSPECTION",
  "UNPLANNED_INSPECTION",
];

const FORM_HINTS: Partial<Record<InspectionType, string>> = {
  NIGHT_INSPECTION: "Шөнийн ХШ-ын маягт Үндсэн хүснэгтүүд дээр байна",
  JOINT_INSPECTION: "Хамтарсан ХШ-ын маягт Үндсэн хүснэгтүүд дээр байна",
  DOCUMENT_INSPECTION: "Бичиг баримтын шалгалт хуудас шаардахгүй",
};

export function NewRunForm({
  action,
  defaultAnnualPlanId,
  defaultTemplateId,
  defaultFollowUpOfRunId,
  annualPlans,
  templates,
  followUpCandidates,
  today,
}: {
  action: (formData: FormData) => void | Promise<void>;
  defaultAnnualPlanId?: string;
  defaultTemplateId?: string;
  defaultFollowUpOfRunId?: string;
  annualPlans: AnnualPlanRow[];
  templates: InspectionTemplate[];
  followUpCandidates: InspectionRun[];
  today: string;
}) {
  const defaultFollowUpRun = followUpCandidates.find(
    (run) => run.id === defaultFollowUpOfRunId,
  );
  const defaultAnnualPlan = annualPlans.find((plan) => plan.id === defaultAnnualPlanId);
  const [inspectionType, setInspectionType] =
    useState<InspectionType>(
      defaultAnnualPlan?.inspectionType ??
        defaultFollowUpRun?.inspectionType ??
        "CHECKLIST",
    );
  const [planMetric, setPlanMetric] = useState<AnnualPlanMetric>(
    defaultAnnualPlan?.metric === "regular"
      ? "as_needed"
      : defaultAnnualPlan?.metric ?? (defaultFollowUpRun ? "completed" : "planned"),
  );
  const [useAnnualPlan, setUseAnnualPlan] = useState(Boolean(defaultAnnualPlan));
  const [annualPlanId, setAnnualPlanId] = useState(defaultAnnualPlan?.id ?? "");
  const [templateId, setTemplateId] = useState(
    defaultAnnualPlan?.templateId ?? defaultFollowUpRun?.templateId ?? defaultTemplateId ?? "",
  );
  const [followUpOfRunId, setFollowUpOfRunId] = useState(defaultFollowUpOfRunId ?? "");
  const selectedPlan = annualPlans.find((plan) => plan.id === annualPlanId);
  const selectedFollowUpRun = followUpCandidates.find((run) => run.id === followUpOfRunId);
  const isSpecialFormType =
    inspectionType === "NIGHT_INSPECTION" ||
    inspectionType === "JOINT_INSPECTION" ||
    inspectionType === "DOCUMENT_INSPECTION";
  const requiresTemplate =
    !isSpecialFormType &&
    (inspectionType === "CHECKLIST" ||
      inspectionType === "STATE_INSPECTION" ||
      inspectionType === "UNPLANNED_INSPECTION");
  const templateOptions = useMemo(() => {
    const activeTemplates = templates.filter((template) => template.active);
    let options =
      inspectionType !== "UNPLANNED_INSPECTION" &&
      inspectionType !== "NIGHT_INSPECTION" &&
      inspectionType !== "JOINT_INSPECTION"
        ? activeTemplates
        : activeTemplates.filter((template) => {
            const selectedTypeLabel = INSPECTION_TYPE_LABELS[inspectionType];
            return (
              template.category === selectedTypeLabel ||
              template.title === selectedTypeLabel
            );
          });

    const ensureIds = [
      templateId,
      selectedFollowUpRun?.templateId,
      defaultTemplateId,
    ].filter(Boolean) as string[];
    for (const id of ensureIds) {
      if (options.some((template) => template.id === id)) continue;
      const extra = templates.find((template) => template.id === id);
      if (extra) options = [extra, ...options];
    }
    return options;
  }, [
    inspectionType,
    templates,
    templateId,
    selectedFollowUpRun?.templateId,
    defaultTemplateId,
  ]);
  const selectedTemplate = templateOptions.find((template) => template.id === templateId);
  const plannedDate =
    selectedPlan && Object.values(selectedPlan.detailDates).flat().sort()[0];
  const showTemplateSelect =
    !useAnnualPlan &&
    (requiresTemplate || (isSpecialFormType && templateOptions.length > 0));

  function applyFollowUpRun(runId: string) {
    const sourceRun = followUpCandidates.find((item) => item.id === runId);
    setFollowUpOfRunId(runId);
    if (!sourceRun) return;
    setUseAnnualPlan(false);
    setAnnualPlanId("");
    setPlanMetric("completed");
    setInspectionType(sourceRun.inspectionType);
    setTemplateId(sourceRun.templateId ?? "");
  }

  return (
    <form
      action={action}
      className="max-w-2xl space-y-4 rounded-md border border-[var(--border)] bg-white p-4"
    >
      <label className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-slate-50 px-3 py-2 text-sm">
        <input
          className="h-4 w-4"
          name="useAnnualPlan"
          type="checkbox"
          checked={useAnnualPlan}
          onChange={(event) => {
            setUseAnnualPlan(event.target.checked);
            if (!event.target.checked) setAnnualPlanId("");
          }}
        />
        <span className="font-medium">Төлөвлөгөөнөөс сонгох</span>
      </label>

      {useAnnualPlan ? (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">
            Төлөвлөгөөнд орсон ХШ-ын хуудас
          </span>
          <select
            className="select w-full"
            name="annualPlanId"
            value={annualPlanId}
            onChange={(event) => {
              const nextPlanId = event.target.value;
              const plan = annualPlans.find((item) => item.id === nextPlanId);
              setAnnualPlanId(nextPlanId);
              if (plan) {
                setInspectionType(plan.inspectionType);
                setPlanMetric(plan.metric === "regular" ? "as_needed" : plan.metric);
              }
            }}
            required
          >
            <option value="" disabled>
              Төлөвлөгөөний ХШ сонгох...
            </option>
            {annualPlans.map((plan) => {
              const date = Object.values(plan.detailDates).flat().sort()[0];
              return (
                <option key={plan.id} value={plan.id}>
                  {plan.checklistName}
                  {date ? ` · ${date}` : ""}
                </option>
              );
            })}
          </select>
          {selectedPlan ? (
            <div className="mt-1 text-xs text-[var(--muted)]">
              {INSPECTION_TYPE_LABELS[selectedPlan.inspectionType]}
              {plannedDate ? ` · ${plannedDate}` : ""}
            </div>
          ) : null}
        </label>
      ) : null}

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Төлөвлөлтийн ангилал</span>
        <select
          className="select w-full"
          name="planMetric"
          value={planMetric}
          disabled={useAnnualPlan || Boolean(followUpOfRunId)}
          onChange={(event) =>
            setPlanMetric(event.target.value as AnnualPlanMetric)
          }
        >
          {PLAN_METRIC_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {useAnnualPlan || followUpOfRunId ? (
          <input type="hidden" name="planMetric" value={planMetric} />
        ) : null}
      </label>

      {planMetric === "completed" ? (
        <div className="rounded-md border border-[var(--border)] bg-slate-50 p-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Гүйцэтгэлийн ХШ хийх эх ХШ</span>
            <select
              className="select w-full"
              name="followUpOfRunId"
              value={followUpOfRunId}
              required
              onChange={(event) => applyFollowUpRun(event.target.value)}
            >
              <option value="">Эх ХШ сонгох...</option>
              {followUpCandidates.map((sourceRun) => (
                <option key={sourceRun.id} value={sourceRun.id}>
                  {sourceRun.inspectionDate} - {INSPECTION_TYPE_LABELS[sourceRun.inspectionType]} - {sourceRun.title}
                </option>
              ))}
            </select>
          </label>
          {selectedFollowUpRun ? (
            <div className="mt-2 text-xs text-[var(--muted)]">
              Энэ гүйцэтгэлийн ХШ нь сонгосон эх ХШ-ийн ижил асуулт дээрх зөрчлийн төлөвийг шинэчилнэ.
            </div>
          ) : null}
          <label className="mt-3 block text-sm">
            <span className="mb-1 block font-medium">Гүйцэтгэлийн ХШ тэмдэглэл</span>
            <textarea
              className="input min-h-20 w-full"
              name="followUpNotes"
              placeholder="Жишээ: Зөрчил арилгасан эсэхийг газар дээр нь дахин шалгав."
            />
          </label>
        </div>
      ) : null}

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Төрөл</span>
        <select
          className="select w-full"
          name="inspectionType"
          value={inspectionType}
          disabled={useAnnualPlan || Boolean(selectedFollowUpRun)}
          onChange={(event) => {
            const nextType = event.target.value as InspectionType;
            setInspectionType(nextType);
            setTemplateId("");
          }}
        >
          {TYPE_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {INSPECTION_TYPE_LABELS[value]}
            </option>
          ))}
        </select>
        {useAnnualPlan || selectedFollowUpRun ? (
          <input type="hidden" name="inspectionType" value={inspectionType} />
        ) : null}
      </label>

      {showTemplateSelect ? (
        <label className="block text-sm">
          <span className="mb-1 block font-medium">
            {isSpecialFormType
              ? `${INSPECTION_TYPE_LABELS[inspectionType]} хуудас`
              : "Хяналтын хуудас"}
          </span>
          <select
            className="select w-full"
            name="templateId"
            required={requiresTemplate}
            value={templateId}
            onChange={(event) => setTemplateId(event.target.value)}
          >
            <option value="" disabled={requiresTemplate}>
              {requiresTemplate ? "Сонгох..." : "Тусгай маягт (хуудасгүй)"}
            </option>
            {templateOptions.map((template) => (
              <option key={template.id} value={template.id}>
                {template.code} - {template.title}
              </option>
            ))}
          </select>
          {isSpecialFormType ? (
            <div className="mt-1 text-xs text-[var(--muted)]">
              {templateId
                ? "Сонгосон хуудсаар гүйцэтгэлийн ХШ үүснэ."
                : "Хуудас сонгохгүй бол үндсэн хүснэгтийн тусгай маягтаар үүснэ."}
            </div>
          ) : null}
        </label>
      ) : (
        <div className="rounded-md border border-[var(--border)] bg-slate-50 px-3 py-2 text-sm text-[var(--muted)]">
          {useAnnualPlan
            ? "Төлөвлөгөөнд сонгосон хуудас/маягт ашиглагдана"
            : isSpecialFormType
              ? `${INSPECTION_TYPE_LABELS[inspectionType]} тусгай маягтаар үүснэ.`
              : FORM_HINTS[inspectionType] ??
                "Энэ төрлийн шалгалт хуудас шаардахгүй"}
        </div>
      )}

      {!showTemplateSelect && templateId ? (
        <input type="hidden" name="templateId" value={templateId} />
      ) : null}

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Гарчиг (заавал биш)</span>
        <input
          className="input w-full"
          name="title"
          key={defaultFollowUpRun?.id ?? "new-run-title"}
          defaultValue={
            defaultFollowUpRun
              ? `Гүйцэтгэлийн ХШ - ${defaultFollowUpRun.title}`
              : undefined
          }
          placeholder={
            selectedTemplate
              ? selectedTemplate.title
              : selectedFollowUpRun
                ? `Гүйцэтгэлийн ХШ - ${selectedFollowUpRun.title}`
                : "Автоматаар бөглөгдөнө"
          }
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Хадгалах төлөв</span>
        <select className="select w-full" name="status" defaultValue="in_progress">
          {INSPECTION_RUN_SAVE_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Шалгалт эхлүүлсэн</span>
          <input
            className="input w-full"
            type="date"
            name="inspectionDate"
            defaultValue={today}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Дуусгах хугацаа</span>
          <input className="input w-full" type="date" name="dueDate" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Дуусгасан хугацаа</span>
          <input className="input w-full" type="date" name="completedDate" />
        </label>
      </div>

      <button type="submit" className="btn btn-primary">
        Үүсгээд нээх
      </button>
    </form>
  );
}
