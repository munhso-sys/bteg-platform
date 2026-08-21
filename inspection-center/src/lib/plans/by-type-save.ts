import { revalidatePath } from "next/cache";
import {
  runPlanStoreMutation,
  syncByTypePlanToAnnualPlans,
  upsertAnnualPlanTypeTarget,
} from "@/lib/store";
import {
  ANNUAL_PLAN_TYPE_ORDER,
  type AnnualPlanPeriodCounts,
  type InspectionType,
} from "@/lib/types";

export function revalidatePlanPaths() {
  revalidatePath("/plans");
  revalidatePath("/plans/by-type");
  revalidatePath("/plans/annual");
  revalidatePath("/plans/gaps");
  revalidatePath("/runs");
}

export function parseAnnualPlanByTypeForm(formData: FormData) {
  const year = Number(formData.get("year") || new Date().getFullYear());
  const counts: Partial<Record<InspectionType, AnnualPlanPeriodCounts>> = {};
  const notes: Partial<Record<InspectionType, string>> = {};

  for (const type of ANNUAL_PLAN_TYPE_ORDER) {
    const total = Number(formData.get(`total:${type}`) || 0);
    counts[type] = {
      quarter: 0,
      month: 0,
      shift: Math.max(0, total),
    };
    notes[type] = String(formData.get(`note:${type}`) || "").trim();
  }

  let checklistMonths: Record<string, boolean[]> = {};
  try {
    checklistMonths = JSON.parse(
      String(formData.get("checklistMonths") || "{}"),
    ) as Record<string, boolean[]>;
  } catch {
    checklistMonths = {};
  }

  return { year, counts, checklistMonths, notes };
}

/** Shared by server action + REST — avoids waiting on full store remote upsert. */
export async function applyAnnualPlanByTypeForm(formData: FormData) {
  const { year, counts, checklistMonths, notes } =
    parseAnnualPlanByTypeForm(formData);
  await runPlanStoreMutation(() => {
    upsertAnnualPlanTypeTarget({ year, counts, checklistMonths, notes });
    syncByTypePlanToAnnualPlans({ year, checklistMonths, counts });
  });
  revalidatePlanPaths();
  return { year };
}
