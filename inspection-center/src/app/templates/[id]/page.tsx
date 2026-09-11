import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { Panel, StatusBadge } from "@/components/ui/primitives";
import { TemplateChecklistEditor } from "@/components/templates/TemplateChecklistEditor";
import {
  getTemplateQuestions,
  readStore,
  replaceTemplateSheet,
  upsertTemplate,
} from "@/lib/store";

export const dynamic = "force-dynamic";

async function saveTemplate(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  upsertTemplate({
    id,
    code: String(formData.get("code") || ""),
    title: String(formData.get("title") || ""),
    category: String(formData.get("category") || ""),
    regulatorySource: String(formData.get("regulatorySource") || ""),
    active: formData.get("active") === "on",
  });
  revalidatePath(`/templates/${id}`);
  revalidatePath("/templates");
  redirect(`/templates/${id}`);
}

async function saveSheetAction(
  templateId: string,
  payload: {
    sections: Array<{
      id: string;
      title: string;
      sectionNo?: string;
      orderIndex: number;
    }>;
    questions: Array<{
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
  },
) {
  "use server";
  const ok = replaceTemplateSheet(templateId, payload);
  if (!ok) return { ok: false as const, error: "Хуудас олдсонгүй" };
  revalidatePath(`/templates/${templateId}`);
  revalidatePath("/templates");
  revalidatePath("/runs");
  return { ok: true as const };
}

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = readStore();
  const template = data.templates.find((t) => t.id === id);
  if (!template) notFound();

  const sections = data.sections
    .filter((s) => s.templateId === template.id)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const questions = getTemplateQuestions(data, template.id);

  return (
    <div>
      <PageHeader
        title={`${template.code} — ${template.title}`}
        subtitle={`${template.category} · эх сурвалж: ${template.sourceSheetName} · х${template.version}`}
        actions={
          <>
            <Link href="/templates" className="btn">
              Буцах
            </Link>
            <ExportButtons
              tableId="questions-table"
              filename={`${template.code}-questions`}
            />
            <Link
              href={`/runs/new?templateId=${template.id}`}
              className="btn btn-primary"
            >
              Шалгалт эхлүүлэх
            </Link>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <StatusBadge tone="brand">{questions.length} асуулт</StatusBadge>
        <StatusBadge>{sections.length} хэсэг</StatusBadge>
        <StatusBadge tone={template.active ? "ok" : "neutral"}>
          {template.active ? "Идэвхтэй" : "Идэвхгүй"}
        </StatusBadge>
      </div>

      <div className="mb-4">
        <Panel title="Хуудасны мэдээлэл засах">
          <form action={saveTemplate} className="grid gap-2 md:grid-cols-2">
            <input type="hidden" name="id" value={template.id} />
            <label className="grid gap-1 text-xs font-medium text-[var(--muted)]">
              Код
              <input
                className="input"
                name="code"
                defaultValue={template.code}
                required
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-[var(--muted)]">
              Гарчиг
              <input
                className="input"
                name="title"
                defaultValue={template.title}
                required
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-[var(--muted)]">
              Ангилал
              <input
                className="input"
                name="category"
                defaultValue={template.category}
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-[var(--muted)]">
              Эх сурвалж
              <input
                className="input"
                name="regulatorySource"
                defaultValue={template.regulatorySource ?? ""}
              />
            </label>
            <label className="flex items-center gap-2 text-sm md:col-span-2">
              <input
                type="checkbox"
                name="active"
                defaultChecked={template.active}
              />
              Идэвхтэй
            </label>
            <button className="btn btn-primary md:col-span-2" type="submit">
              Мэдээлэл хадгалах
            </button>
          </form>
        </Panel>
      </div>

      <Panel title="Хяналт шалгалтын хуудас (Excel загвар)">
        <p className="mb-3 text-xs text-[var(--muted)]">
          Дугаарлалт автомат. Мөр хооронд асуулт/ногоон хэсэг оруулах, хууль·заалтын
          баганыг босоо нэгтгэх, хэсгийн болон нийт оноо автоматаар тооцогдоно.
        </p>
        <TemplateChecklistEditor
          templateId={template.id}
          templateTitle={`${template.code} ${template.title}`.trim()}
          initialSections={sections}
          initialQuestions={questions}
          saveSheet={saveSheetAction}
        />
      </Panel>
    </div>
  );
}
