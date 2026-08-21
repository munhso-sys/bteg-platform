"use server";

import { revalidatePath } from "next/cache";
import { revalidateActionsPaths } from "@/app/actions/cache";
import { revalidateFindingsPaths } from "@/app/findings/cache";
import { assertInspectionWriteAccess } from "@/lib/access/scope";
import {
  deleteResolvedFindingArchiveRow,
  runStoreMutation,
  upsertCorrectiveAction,
} from "@/lib/store";
import type { ActionStatus } from "@/lib/types";

function asNullableString(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || null;
}

export async function updateActionPlan(formData: FormData) {
  await assertInspectionWriteAccess();
  await runStoreMutation(() =>
    upsertCorrectiveAction({
      id: asNullableString(formData.get("id")),
      findingId: String(formData.get("findingId") || ""),
      actionText: String(formData.get("actionText") || "").trim(),
      responsibleEmployeeId: asNullableString(
        formData.get("responsibleEmployeeId"),
      ),
      responsibleOrgUnitId: asNullableString(
        formData.get("responsibleOrgUnitId"),
      ),
      startDate: asNullableString(formData.get("startDate")),
      dueDate: asNullableString(formData.get("dueDate")),
      progressPercent: Number(formData.get("progressPercent") || 0),
      status: String(formData.get("status") || "assigned") as ActionStatus,
      managerComment: String(formData.get("managerComment") || "").trim(),
    }),
  );
  revalidateActionsPaths();
  revalidateFindingsPaths();
  revalidatePath("/dashboard");
}

export async function deleteResolvedArchiveRow(formData: FormData) {
  await assertInspectionWriteAccess();
  await runStoreMutation(() =>
    deleteResolvedFindingArchiveRow(String(formData.get("findingId") || "")),
  );
  revalidateActionsPaths();
  revalidateFindingsPaths();
  revalidatePath("/dashboard");
}
