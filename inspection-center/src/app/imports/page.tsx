import { revalidatePath } from "next/cache";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel, StatusBadge } from "@/components/ui/primitives";
import { readStore, reloadTemplatesFromImport } from "@/lib/store";
import * as fs from "fs";
import * as path from "path";

export const dynamic = "force-dynamic";

async function reloadAction() {
  "use server";
  reloadTemplatesFromImport();
  revalidatePath("/templates");
  revalidatePath("/dashboard");
  revalidatePath("/imports");
}

export default function ImportsPage() {
  const data = readStore();
  const importFile = path.join(process.cwd(), "data", "imported-templates.json");
  const masterImportFile = path.join(
    process.cwd(),
    "data",
    "imported-master-sheets.json",
  );
  let importMeta: {
    importedAt?: string;
    workbookPath?: string;
    sheetSummary?: {
      total: number;
      visible: number;
      hidden: number;
      checklistTemplates: number;
    };
  } | null = null;
  let masterImportMeta: {
    importedAt?: string;
    workbookPath?: string;
    checklistCatalog?: unknown[];
    jointInspectionItems?: unknown[];
    stateInspectionRows?: unknown[];
    nightInspectionItems?: unknown[];
    documentInspectionItems?: unknown[];
  } | null = null;

  if (fs.existsSync(importFile)) {
    importMeta = JSON.parse(fs.readFileSync(importFile, "utf8"));
  }
  if (fs.existsSync(masterImportFile)) {
    masterImportMeta = JSON.parse(fs.readFileSync(masterImportFile, "utf8"));
  }

  return (
    <div>
      <PageHeader
        title="Импорт"
        subtitle="Эксель хяналтын хуудас болон үндсэн ажлын дэвтэр импорт"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Сүүлийн хуудасны импорт">
          {importMeta ? (
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-[var(--muted)]">Огноо: </span>
                {importMeta.importedAt}
              </div>
              <div className="break-all">
                <span className="text-[var(--muted)]">Ажлын дэвтэр: </span>
                {importMeta.workbookPath}
              </div>
              {importMeta.sheetSummary ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  <StatusBadge>
                    нийт {importMeta.sheetSummary.total}
                  </StatusBadge>
                  <StatusBadge tone="ok">
                    харагдах {importMeta.sheetSummary.visible}
                  </StatusBadge>
                  <StatusBadge>
                    нуугдсан {importMeta.sheetSummary.hidden}
                  </StatusBadge>
                  <StatusBadge tone="brand">
                    хяналтын хуудас {importMeta.sheetSummary.checklistTemplates}
                  </StatusBadge>
                </div>
              ) : null}
              <div className="pt-2 text-[var(--muted)]">
                Хадгаламжид: {data.templates.length} хуудас ·{" "}
                {data.questions.length} асуулт
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Хуудас импорт хийгдээгүй байна.
            </p>
          )}
        </Panel>

        <Panel title="Үндсэн ажлын дэвтэр">
          {masterImportMeta ? (
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-[var(--muted)]">Огноо: </span>
                {masterImportMeta.importedAt}
              </div>
              <div className="break-all">
                <span className="text-[var(--muted)]">Ажлын дэвтэр: </span>
                {masterImportMeta.workbookPath}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <StatusBadge tone="brand">
                  каталог {masterImportMeta.checklistCatalog?.length ?? 0}
                </StatusBadge>
                <StatusBadge tone="ok">
                  хамтарсан {masterImportMeta.jointInspectionItems?.length ?? 0}
                </StatusBadge>
                <StatusBadge>
                  төрийн {masterImportMeta.stateInspectionRows?.length ?? 0}
                </StatusBadge>
                <StatusBadge>
                  шөнийн {masterImportMeta.nightInspectionItems?.length ?? 0}
                </StatusBadge>
                <StatusBadge tone="brand">
                  баримт {masterImportMeta.documentInspectionItems?.length ?? 0}
                </StatusBadge>
              </div>
              <div className="pt-2 text-[var(--muted)]">
                ХШХ-1, ХШТөрийн, ХШХамтарсан, ХШШөнийн хүснэгтүүдийг тусдаа
                үйл ажиллагааны импорт болгон хадгалсан.
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Үндсэн ажлын дэвтэр импорт хийгдээгүй байна.
            </p>
          )}
        </Panel>

        <Panel title="Командын мөр">
          <pre className="overflow-x-auto rounded bg-slate-950 p-3 text-xs text-slate-100">
{`# Жагсаалт харах
npx tsx scripts/import-excel.ts --list-only

# Харагдах хяналтын хуудсуудыг импортлох
npx tsx scripts/import-excel.ts

# Үндсэн ажлын дэвтэр импорт
npm run import:master -- "C:/Users/Owner/.openclaw/media/inbound/ХШ---3be8ab4c-7ae7-4737-94f6-e87c83633f3d.xlsx"
`}
          </pre>
          <form action={reloadAction} className="mt-3">
            <button type="submit" className="btn btn-primary">
              Импортлогдсон хуудсуудыг хадгаламжид ачаалах
            </button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
