import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { revalidateActionsPaths } from "@/app/actions/cache";
import { revalidateFindingsPaths } from "@/app/findings/cache";
import {
  createActionForFinding,
  createFindingFromAnswer,
  runStoreMutation,
} from "@/lib/store";
import { requireInspectionWriteAccess } from "@/lib/access/scope";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireInspectionWriteAccess();
  if (gate.error) return gate.error;

  const { id: runId } = await context.params;
  const body = (await request.json()) as {
    answerId?: string;
    actionText?: string;
  };

  if (!body.answerId) {
    return NextResponse.json({ error: "answerId required" }, { status: 400 });
  }

  try {
    const result = await runStoreMutation(() => {
      const finding = createFindingFromAnswer(body.answerId!);
      if (finding.runId !== runId) {
        throw new Error("Finding/run mismatch");
      }
      const action = createActionForFinding(
        finding.id,
        body.actionText || "Зөрчлийг арилгах",
      );
      return { finding, action };
    });
    revalidatePath("/runs");
    revalidatePath(`/runs/${runId}`);
    revalidateActionsPaths();
    revalidateFindingsPaths();
    revalidatePath("/dashboard");
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}
