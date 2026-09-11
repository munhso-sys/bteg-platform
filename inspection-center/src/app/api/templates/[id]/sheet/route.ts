import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireInspectionWriteAccess } from "@/lib/access/scope";
import { replaceTemplateSheet } from "@/lib/store";

type SheetBody = {
  sections?: Array<{
    id: string;
    title: string;
    sectionNo?: string;
    orderIndex: number;
  }>;
  questions?: Array<{
    id: string;
    sectionId: string | null;
    questionNo: string;
    legalReference: string;
    legalMergeGroupId?: string | null;
    questionText: string;
    approvedScore: number;
    orderIndex: number;
    active?: boolean;
  }>;
};

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const gate = await requireInspectionWriteAccess();
  if (gate.error) return gate.error;

  const { id: templateId } = await context.params;
  try {
    const body = (await request.json()) as SheetBody;
    if (!Array.isArray(body.sections) || !Array.isArray(body.questions)) {
      return NextResponse.json(
        { ok: false, error: "Буруу өгөгдөл" },
        { status: 400 },
      );
    }
    const ok = replaceTemplateSheet(templateId, {
      sections: body.sections,
      questions: body.questions,
    });
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "Хуудас олдсонгүй" },
        { status: 404 },
      );
    }
    revalidatePath(`/templates/${templateId}`);
    revalidatePath("/templates");
    revalidatePath("/runs");
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Серверийн алдаа";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
