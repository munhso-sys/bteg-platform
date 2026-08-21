"use server";

import { revalidatePath } from "next/cache";
import { assertInspectionWriteAccess } from "@/lib/access/scope";
import {
  readStore,
  runStoreMutation,
  upsertAnnualPlanRow,
} from "@/lib/store";
import {
  applyAnnualPlanByTypeForm,
  revalidatePlanPaths,
} from "@/lib/plans/by-type-save";
import type { AnnualPlanMetric, InspectionType } from "@/lib/types";

export async function saveAnnualPlan(formData: FormData) {
  await assertInspectionWriteAccess();
  await runStoreMutation(() => {
    const data = readStore();
    const templateId = String(formData.get("templateId") || "");
    const template = templateId
      ? data.templates.find((item) => item.id === templateId)
      : null;

    upsertAnnualPlanRow({
      id: String(formData.get("id") || "") || undefined,
      inspectionType: String(
        formData.get("inspectionType") || "CHECKLIST",
      ) as InspectionType,
      checklistName: template
        ? `${template.code} - ${template.title}`
        : String(formData.get("checklistName") || ""),
      templateId: template?.id,
      metric: String(formData.get("metric") || "planned") as AnnualPlanMetric,
      year: Number(formData.get("year") || new Date().getFullYear()),
      month: Number(formData.get("month") || 1),
      count: Number(formData.get("count") || 0),
      detailDate: String(formData.get("detailDate") || "") || undefined,
    });
  });

  revalidatePlanPaths();
  revalidatePath("/runs");
}

export async function saveAnnualPlanByType(formData: FormData) {
  await assertInspectionWriteAccess();
  await applyAnnualPlanByTypeForm(formData);
}
