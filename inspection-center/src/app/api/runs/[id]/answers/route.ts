import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { revalidateActionsPaths } from "@/app/actions/cache";
import { revalidateFindingsPaths } from "@/app/findings/cache";
import {
  resetRunAnswers,
  runStoreMutation,
  saveJointUnitScopeAndSync,
  updateAnswerScore,
  updateRunAnswersAndSyncFindings,
} from "@/lib/store";
import type { InspectionRunSaveStatus } from "@/lib/types";
import { isInspectionRunSaveStatus } from "@/lib/types";
import { requireInspectionWriteAccess } from "@/lib/access/scope";

function revalidateRunPaths(runId: string) {
  revalidatePath("/runs");
  revalidatePath(`/runs/${runId}`);
  revalidatePath("/plans");
  revalidateActionsPaths();
  revalidateFindingsPaths();
  revalidatePath("/dashboard");
}

function normalizePerformers(
  performers:
    | { place?: string; name?: string; position?: string }[]
    | undefined,
) {
  if (!Array.isArray(performers)) return undefined;
  return performers
    .map((row) => ({
      place: String(row.place ?? "").trim(),
      name: String(row.name ?? "").trim(),
      position: String(row.position ?? "").trim(),
    }))
    .filter((row) => row.place || row.name || row.position);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireInspectionWriteAccess();
  if (gate.error) return gate.error;

  const { id: runId } = await context.params;
  const body = (await request.json()) as {
    answerId?: string;
    isApplicable?: boolean;
    receivedScore?: number;
    comment?: string;
    reset?: boolean;
    answers?: {
      answerId: string;
      isApplicable?: boolean;
      receivedScore?: number;
      comment?: string;
      photoUrl?: string | null;
      photoName?: string | null;
    }[];
    status?: InspectionRunSaveStatus;
    inspectionDate?: string;
    dueDate?: string | null;
    completedDate?: string | null;
    syncFindings?: boolean;
    jointUnitKey?: string;
    jointUnitLabel?: string;
    performers?: { place?: string; name?: string; position?: string }[];
    notes?: string;
    confirmationText?: string;
  };

  if (body.reset) {
    try {
      const answers = await runStoreMutation(() => resetRunAnswers(runId));
      revalidateRunPaths(runId);
      return NextResponse.json({ answers });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed" },
        { status: 400 },
      );
    }
  }

  if (Array.isArray(body.answers) && body.jointUnitKey) {
    try {
      const performers = normalizePerformers(body.performers);
      const result = await runStoreMutation(() =>
        saveJointUnitScopeAndSync({
          runId,
          unitKey: body.jointUnitKey!,
          unitLabel: body.jointUnitLabel || body.jointUnitKey!,
          answers: body.answers!,
          status: isInspectionRunSaveStatus(body.status)
            ? body.status
            : undefined,
          inspectionDate: body.inspectionDate,
          dueDate: body.dueDate,
          completedDate: body.completedDate,
          performers,
          notes: body.notes,
          confirmationText: body.confirmationText,
          answeredBy: "inspector-1",
        }),
      );
      revalidateRunPaths(runId);
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed" },
        { status: 400 },
      );
    }
  }

  if (Array.isArray(body.answers)) {
    try {
      const performers = normalizePerformers(body.performers);
      const result = await runStoreMutation(() =>
        updateRunAnswersAndSyncFindings({
          runId,
          answers: body.answers!,
          status: isInspectionRunSaveStatus(body.status)
            ? body.status
            : undefined,
          inspectionDate: body.inspectionDate,
          dueDate: body.dueDate,
          completedDate: body.completedDate,
          performers,
          notes: body.notes,
          confirmationText: body.confirmationText,
          answeredBy: "inspector-1",
        }),
      );
      revalidateRunPaths(runId);
      return NextResponse.json(result);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed" },
        { status: 400 },
      );
    }
  }

  if (!body.answerId) {
    return NextResponse.json({ error: "answerId required" }, { status: 400 });
  }

  try {
    const answer = await runStoreMutation(() =>
      updateAnswerScore({
        answerId: body.answerId!,
        isApplicable: body.isApplicable,
        receivedScore: body.receivedScore,
        comment: body.comment,
        answeredBy: "inspector-1",
      }),
    );
    if (answer.runId !== runId) {
      return NextResponse.json({ error: "Answer/run mismatch" }, { status: 400 });
    }
    revalidateRunPaths(runId);
    return NextResponse.json({ answer });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}
