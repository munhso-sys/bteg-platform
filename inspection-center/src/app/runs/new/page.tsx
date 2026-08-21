import { redirect, unstable_rethrow } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { NewRunForm } from "@/components/runs/NewRunForm";
import {
  createRunFromTemplate,
  ensureStoreHydrated,
  readAnnualPlans,
  readStore,
  runStoreMutation,
} from "@/lib/store";
import {
  INSPECTION_TYPE_LABELS,
  type AnnualPlanMetric,
  type InspectionType,
  type RunStatus,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const SPECIAL_FORM_TYPES = new Set<InspectionType>([
  "NIGHT_INSPECTION",
  "JOINT_INSPECTION",
  "DOCUMENT_INSPECTION",
]);

async function createRunAction(formData: FormData) {
  "use server";

  const { assertInspectionWriteAccess } = await import("@/lib/access/scope");
  await assertInspectionWriteAccess();

  let createdRunId = "";
  try {
    await ensureStoreHydrated();
    const annualPlanId = String(formData.get("annualPlanId") || "");
    const annualPlan = annualPlanId
      ? readAnnualPlans().find((row) => row.id === annualPlanId)
      : null;
    const planMetric = (annualPlan?.metric ??
      String(formData.get("planMetric") || "planned")) as AnnualPlanMetric;
    const followUpOfRunId =
      planMetric === "completed"
        ? String(formData.get("followUpOfRunId") || "")
        : "";
    const followUpNotes = String(formData.get("followUpNotes") || "");
    const originalRun = followUpOfRunId
      ? readStore().runs.find((item) => item.id === followUpOfRunId)
      : null;

    if (planMetric === "completed" && !originalRun) {
      throw new Error("Гүйцэтгэлийн ХШ үүсгэхийн тулд эх ХШ сонгоно уу.");
    }

    const templateId =
      annualPlan?.templateId ??
      (String(formData.get("templateId") || "") ||
        originalRun?.templateId ||
        "");
    const selectedTemplate = templateId
      ? readStore().templates.find((template) => template.id === templateId)
      : null;
    const inspectionType = (annualPlan?.inspectionType ??
      originalRun?.inspectionType ??
      String(formData.get("inspectionType") || "CHECKLIST")) as InspectionType;
    const inspectedByOrg = String(formData.get("inspectedByOrg") || "ДХШ");
    const plannedDate =
      annualPlan && Object.values(annualPlan.detailDates).flat().sort()[0];
    const inspectionDate =
      plannedDate || String(formData.get("inspectionDate") || "");
    const dueDate = String(formData.get("dueDate") || "");
    const completedDate = String(formData.get("completedDate") || "");
    const manualTitle = String(formData.get("title") || "").trim();
    const title =
      annualPlan?.checklistName ??
      (manualTitle ||
        (originalRun
          ? `Гүйцэтгэлийн ХШ - ${originalRun.title}`
          : "") ||
        (selectedTemplate
          ? `${selectedTemplate.code} ${selectedTemplate.title}`
          : ""));
    const status = String(formData.get("status") || "in_progress") as RunStatus;
    const allowsSpecialForm = SPECIAL_FORM_TYPES.has(inspectionType);

    if (!templateId && !allowsSpecialForm) {
      throw new Error("Хяналтын хуудас сонгоно уу.");
    }

    if (templateId && !selectedTemplate) {
      throw new Error("Сонгосон хяналтын хуудас олдсонгүй.");
    }

    const run = await runStoreMutation(() =>
      createRunFromTemplate({
        templateId: selectedTemplate?.id,
        inspectionType,
        planMetric: planMetric === "regular" ? "as_needed" : planMetric,
        planId: annualPlan?.id ?? null,
        inspectedByOrg,
        inspectionDate: inspectionDate || undefined,
        dueDate: dueDate || null,
        completedDate: completedDate || null,
        followUpOfRunId: followUpOfRunId || null,
        followUpNotes,
        title: title || INSPECTION_TYPE_LABELS[inspectionType],
        status,
      }),
    );
    createdRunId = run.id;
  } catch (error) {
    unstable_rethrow(error);
    const message =
      error instanceof Error
        ? error.message
        : "Гүйцэтгэлийн ХШ үүсгэхэд алдаа гарлаа.";
    redirect(
      `/runs/new?error=${encodeURIComponent(message)}${
        formData.get("followUpOfRunId")
          ? `&followUpOfRunId=${encodeURIComponent(String(formData.get("followUpOfRunId")))}`
          : ""
      }${
        formData.get("templateId")
          ? `&templateId=${encodeURIComponent(String(formData.get("templateId")))}`
          : ""
      }`,
    );
  }

  redirect(`/runs/${createdRunId}`);
}

export default async function NewRunPage({
  searchParams,
}: {
  searchParams: Promise<{
    annualPlanId?: string;
    templateId?: string;
    followUpOfRunId?: string;
    error?: string;
  }>;
}) {
  const { getInspectionScope, isInspectionReadOnly } = await import(
    "@/lib/access/scope"
  );
  const scope = await getInspectionScope();
  if (isInspectionReadOnly(scope)) {
    redirect("/runs");
  }

  const sp = await searchParams;
  await ensureStoreHydrated();
  const data = readStore();
  const annualPlans = readAnnualPlans().sort((a, b) =>
    `${a.checklistName}-${Object.values(a.detailDates).flat().sort()[0] ?? ""}`.localeCompare(
      `${b.checklistName}-${Object.values(b.detailDates).flat().sort()[0] ?? ""}`,
    ),
  );
  const templates = [...data.templates]
    .filter((template) => template.active)
    .sort((a, b) =>
      a.code.localeCompare(b.code, undefined, { numeric: true }),
    );
  const today = new Date().toISOString().slice(0, 10);
  const followUpCandidates = data.runs
    .filter((run) => run.planMetric !== "completed")
    .sort((a, b) => b.inspectionDate.localeCompare(a.inspectionDate));

  return (
    <div>
      <PageHeader
        title="Шинэ шалгалт"
        subtitle="Төрлөөс хамаарч хяналтын хуудас эсвэл тусгай маягт ашиглана"
      />

      {sp.error ? (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {sp.error}
        </div>
      ) : null}

      <NewRunForm
        action={createRunAction}
        defaultAnnualPlanId={sp.annualPlanId}
        defaultTemplateId={sp.templateId}
        defaultFollowUpOfRunId={sp.followUpOfRunId}
        annualPlans={annualPlans}
        templates={templates}
        followUpCandidates={followUpCandidates}
        today={today}
      />
    </div>
  );
}
