import Link from "next/link";
import { revalidatePath } from "next/cache";
import { PageHeader } from "@/components/layout/PageHeader";
import { TemplatesCategoryTree } from "@/components/templates/TemplatesCategoryTree";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { deleteTemplate, readStore, upsertTemplate } from "@/lib/store";

export const dynamic = "force-dynamic";

async function saveTemplate(formData: FormData) {
  "use server";
  upsertTemplate({
    id: String(formData.get("id") || "") || undefined,
    code: String(formData.get("code") || ""),
    title: String(formData.get("title") || ""),
    category: String(formData.get("category") || ""),
    regulatorySource: String(formData.get("regulatorySource") || ""),
    active: formData.get("active") === "on",
  });
  revalidatePath("/templates");
}

async function removeTemplate(formData: FormData) {
  "use server";
  deleteTemplate(String(formData.get("id") || ""));
  revalidatePath("/templates");
}

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const data = readStore();
  const q = (sp.q ?? "").toLowerCase().trim();
  const category = sp.category ?? "";

  const categories = Array.from(
    new Set(data.templates.map((t) => t.category)),
  ).sort();

  const templates = data.templates
    .filter((t) => {
      if (category && t.category !== category) return false;
      if (!q) return true;
      return (
        t.code.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
    .map((t) => ({
      id: t.id,
      code: t.code,
      title: t.title,
      category: t.category,
      sourceSheetName: t.sourceSheetName,
      active: t.active,
      questionCount: data.questions.filter(
        (x) => x.templateId === t.id && x.active,
      ).length,
    }));

  return (
    <div>
      <PageHeader
        title="Хяналтын хуудсууд"
        subtitle="Эксель-ээс импортлосон хяналтын хуудсууд"
        actions={
          <>
            <ExportButtons tableId="templates-table" filename="checklist-templates" />
            <Link href="/imports" className="btn">
              Импорт
            </Link>
          </>
        }
      />

      <form action={saveTemplate} className="mb-4 grid gap-2 rounded-md border border-[var(--border)] bg-white p-3 lg:grid-cols-[120px_1fr_180px_1fr_auto]">
        <input className="input" name="code" placeholder="Код" required />
        <input className="input" name="title" placeholder="Хяналт шалгалтын хуудасны нэр" required />
        <input className="input" name="category" placeholder="Ангилал" />
        <input className="input" name="regulatorySource" placeholder="Эх сурвалж / тайлбар" />
        <button className="btn btn-primary" type="submit">Нэмэх</button>
      </form>

      <form className="mb-4 flex flex-wrap gap-2">
        <input className="input min-w-[240px] flex-1"
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Код / гарчиг / ангилал хайх..."
        />
        <select className="select"
          name="category"
          defaultValue={category}>
          <option value="">Бүх ангилал</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button className="btn btn-primary" type="submit">
          Шүүх
        </button>
      </form>

      <TemplatesCategoryTree rows={templates} onDelete={removeTemplate} />
    </div>
  );
}
