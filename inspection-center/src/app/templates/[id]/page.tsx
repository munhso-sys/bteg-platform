import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { redirect } from "next/navigation";
import { Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { Panel, StatusBadge, TableScroll } from "@/components/ui/primitives";
import {
  deleteTemplateQuestion,
  getTemplateQuestions,
  readStore,
  upsertTemplate,
  upsertTemplateQuestion,
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

async function saveQuestion(formData: FormData) {
  "use server";
  const templateId = String(formData.get("templateId") || "");
  upsertTemplateQuestion({
    id: String(formData.get("id") || "") || undefined,
    templateId,
    questionNo: String(formData.get("questionNo") || ""),
    legalReference: String(formData.get("legalReference") || ""),
    questionText: String(formData.get("questionText") || ""),
    approvedScore: Number(formData.get("approvedScore") || 0),
    orderIndex: Number(formData.get("orderIndex") || 0) || undefined,
    active: formData.get("active") !== "off",
  });
  revalidatePath(`/templates/${templateId}`);
  redirect(`/templates/${templateId}`);
}

async function saveQuestions(formData: FormData) {
  "use server";
  const templateId = String(formData.get("templateId") || "");
  const questionIds = formData.getAll("questionIds").map(String).filter(Boolean);

  for (const id of questionIds) {
    upsertTemplateQuestion({
      id,
      templateId,
      questionNo: String(formData.get(`questionNo:${id}`) || ""),
      legalReference: String(formData.get(`legalReference:${id}`) || ""),
      questionText: String(formData.get(`questionText:${id}`) || ""),
      approvedScore: Number(formData.get(`approvedScore:${id}`) || 0),
      orderIndex: Number(formData.get(`orderIndex:${id}`) || 0) || undefined,
      active: formData.get(`active:${id}`) !== "off",
    });
  }

  revalidatePath(`/templates/${templateId}`);
  revalidatePath("/templates");
  redirect(`/templates/${templateId}`);
}

async function removeQuestion(formData: FormData) {
  "use server";
  const templateId = String(formData.get("templateId") || "");
  deleteTemplateQuestion(String(formData.get("id") || ""));
  revalidatePath(`/templates/${templateId}`);
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
  const questionsFormId = `questions-save-${template.id}`;

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
            <ExportButtons tableId="questions-table" filename={`${template.code}-questions`} />
            <Link
              href={`/runs/new?templateId=${template.id}`} className="btn btn-primary">
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

      <div className="mb-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
        <Panel title="Хуудасны мэдээлэл засах">
          <form action={saveTemplate} className="grid gap-2">
            <input type="hidden" name="id" value={template.id} />
            <label className="grid gap-1 text-xs font-medium text-[var(--muted)]">
              Код
              <input className="input" name="code" defaultValue={template.code} required />
            </label>
            <label className="grid gap-1 text-xs font-medium text-[var(--muted)]">
              Гарчиг
              <input className="input" name="title" defaultValue={template.title} required />
            </label>
            <label className="grid gap-1 text-xs font-medium text-[var(--muted)]">
              Ангилал
              <input className="input" name="category" defaultValue={template.category} />
            </label>
            <label className="grid gap-1 text-xs font-medium text-[var(--muted)]">
              Эх сурвалж
              <input className="input" name="regulatorySource" defaultValue={template.regulatorySource ?? ""} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="active" defaultChecked={template.active} />
              Идэвхтэй
            </label>
            <button className="btn btn-primary" type="submit">Засвар хадгалах</button>
          </form>
        </Panel>

        <Panel title="Мөр нэмэх">
          <form action={saveQuestion} className="grid gap-2">
            <input type="hidden" name="templateId" value={template.id} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input" name="questionNo" placeholder="Дугаар" required />
              <input className="input" name="approvedScore" type="number" step="0.01" placeholder="Оноо" />
            </div>
            <input className="input" name="legalReference" placeholder="Хууль / заалт" />
            <textarea className="textarea" name="questionText" placeholder="Асуулт / шалгах үзүүлэлт" required />
            <button className="btn btn-primary" type="submit">Мөр нэмэх</button>
          </form>
        </Panel>
      </div>

      {sections.length> 0 ? (
        <div className="mb-4">
          <Panel title="Хэсгүүд">
            <ul className="space-y-1 text-sm">
              {sections.map((s) => (
                <li key={s.id}>
                  <span className="font-medium">{s.sectionNo}.</span> {s.title}
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      ) : null}

      <div className="rounded-md border border-[var(--border)] bg-white">
        <form id={questionsFormId} action={saveQuestions}>
          <input type="hidden" name="templateId" value={template.id} />
        </form>
        <TableScroll size="lg" maxHeightClass="max-h-[36rem]" className="rounded-none border-0">
        <table id="questions-table">
          <thead>
            <tr>
              <th className="w-16">№</th>
              <th>Хууль / заалт</th>
              <th>Асуулт</th>
              <th className="w-28">Батлагдсан оноо</th>
              <th className="w-24"></th>
            </tr>
          </thead>
          <tbody>
            {questions.map((q) => (
              <tr key={q.id}>
                <td colSpan={5} className="p-0">
                  <div className="grid gap-2 p-2 lg:grid-cols-[80px_minmax(140px,1fr)_minmax(260px,2fr)_100px_auto]">
                    <input form={questionsFormId} type="hidden" name="questionIds" value={q.id} />
                    <input form={questionsFormId} type="hidden" name={`orderIndex:${q.id}`} value={q.orderIndex} />
                    <input form={questionsFormId} type="hidden" name={`active:${q.id}`} value={q.active ? "on" : "off"} />
                    <input form={questionsFormId} className="input" name={`questionNo:${q.id}`} defaultValue={q.questionNo} />
                    <input form={questionsFormId} className="input" name={`legalReference:${q.id}`} defaultValue={q.legalReference} placeholder="Заалт" />
                    <textarea form={questionsFormId} className="textarea min-h-10" name={`questionText:${q.id}`} defaultValue={q.questionText} />
                    <input form={questionsFormId} className="input" name={`approvedScore:${q.id}`} type="number" step="0.01" defaultValue={q.approvedScore} />
                    <form action={removeQuestion} className="flex items-start">
                      <input type="hidden" name="id" value={q.id} />
                      <input type="hidden" name="templateId" value={template.id} />
                      <button className="btn" type="submit" title="Устгах" aria-label="Устгах">
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </TableScroll>
        <div className="border-t border-[var(--border)] p-3">
          <button className="btn btn-primary" type="submit" form={questionsFormId}>
            Мөрүүд хадгалах
          </button>
        </div>
      </div>
    </div>
  );
}
