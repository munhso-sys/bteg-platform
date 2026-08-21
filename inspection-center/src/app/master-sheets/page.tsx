import { revalidatePath } from "next/cache";
import { PageHeader } from "@/components/layout/PageHeader";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { Panel, TableScroll } from "@/components/ui/primitives";
import {
  deleteChecklistCatalogItem,
  deleteJointInspectionItem,
  deleteNightInspectionItem,
  deleteStateInspectionRow,
  readMasterWorkbook,
  upsertChecklistCatalogItem,
  upsertJointInspectionItem,
  upsertNightInspectionItem,
  upsertStateInspectionRow,
} from "@/lib/store";

export const dynamic = "force-dynamic";

async function saveCatalog(formData: FormData) {
  "use server";
  upsertChecklistCatalogItem({
    id: String(formData.get("id") || "") || undefined,
    sequence: Number(formData.get("sequence") || 0),
    department: String(formData.get("department") || ""),
    orgUnit: String(formData.get("orgUnit") || ""),
    code: String(formData.get("code") || ""),
    title: String(formData.get("title") || ""),
  });
  revalidatePath("/master-sheets");
}

async function saveJoint(formData: FormData) {
  "use server";
  upsertJointInspectionItem({
    id: String(formData.get("id") || "") || undefined,
    sequence: Number(formData.get("sequence") || 0),
    category: String(formData.get("category") || ""),
    item: String(formData.get("item") || ""),
    maxScore: Number(formData.get("maxScore") || 0),
    score: Number(formData.get("score") || 0),
  });
  revalidatePath("/master-sheets");
}

async function saveNight(formData: FormData) {
  "use server";
  upsertNightInspectionItem({
    id: String(formData.get("id") || "") || undefined,
    sequence: Number(formData.get("sequence") || 0),
    area: String(formData.get("area") || ""),
    sectionNo: String(formData.get("sectionNo") || ""),
    sectionTitle: String(formData.get("sectionTitle") || ""),
    item: String(formData.get("item") || ""),
    note: String(formData.get("note") || ""),
  });
  revalidatePath("/master-sheets");
}

async function saveState(formData: FormData) {
  "use server";
  upsertStateInspectionRow({
    id: String(formData.get("id") || "") || undefined,
    sequence: Number(formData.get("sequence") || 0),
    authority: String(formData.get("authority") || ""),
    checklistNumber: String(formData.get("checklistNumber") || ""),
    checklistName: String(formData.get("checklistName") || ""),
    inspectionDate: String(formData.get("inspectionDate") || ""),
    requiredScoreFormulaOrValue: String(formData.get("requiredScoreFormulaOrValue") || ""),
    failedScore: Number(formData.get("failedScore") || 0),
    riskPercentFormulaOrValue: String(formData.get("riskPercentFormulaOrValue") || ""),
    implementationFormulaOrValue: String(formData.get("implementationFormulaOrValue") || ""),
    violationCountFormulaOrValue: String(formData.get("violationCountFormulaOrValue") || ""),
    executionStatus: String(formData.get("executionStatus") || ""),
    responsibleEmployee: String(formData.get("responsibleEmployee") || ""),
    progressPercent: Number(formData.get("progressPercent") || 0),
    dueDate: String(formData.get("dueDate") || ""),
  });
  revalidatePath("/master-sheets");
}

async function removeRow(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const kind = String(formData.get("kind") || "");
  if (kind === "catalog") deleteChecklistCatalogItem(id);
  if (kind === "joint") deleteJointInspectionItem(id);
  if (kind === "night") deleteNightInspectionItem(id);
  if (kind === "state") deleteStateInspectionRow(id);
  revalidatePath("/master-sheets");
}

export default function MasterSheetsPage() {
  const master = readMasterWorkbook();

  return (
    <div>
      <PageHeader
        title="Үндсэн хүснэгтүүд"
        subtitle="Хавсаргасан ажлын дэвтрийн 4 хүснэгт: шөнийн, хамтарсан, төрийн явц, хуудасны ангилал"
        actions={<ExportButtons tableId="catalog-table" filename="master-checklist-catalog" />}
      />

      <div className="mb-5 grid gap-3 md:grid-cols-5">
        <Panel title="ХШХ-1">
          <div className="text-2xl font-semibold tabular-nums">{master.checklistCatalog.length}</div>
          <p className="text-xs text-[var(--muted)]">Хяналт шалгалтын хуудсын ангилал</p>
        </Panel>
        <Panel title="ХШТөрийн">
          <div className="text-2xl font-semibold tabular-nums">{master.stateInspectionRows.length}</div>
          <p className="text-xs text-[var(--muted)]">Зөрчил арилгах явц</p>
        </Panel>
        <Panel title="ХШХамтарсан">
          <div className="text-2xl font-semibold tabular-nums">{master.jointInspectionItems.length}</div>
          <p className="text-xs text-[var(--muted)]">Хамтарсан ХШ-ын форм</p>
        </Panel>
        <Panel title="ХШШөнийн">
          <div className="text-2xl font-semibold tabular-nums">{master.nightInspectionItems.length}</div>
          <p className="text-xs text-[var(--muted)]">Шөнийн ХШ-ын форм</p>
        </Panel>
      </div>

      <div className="space-y-5">
        <Panel
          title="Хүснэгт-ХШХ-1: хяналт шалгалтын хуудсын ангилал"
          actions={<ExportButtons tableId="catalog-table" filename="checklist-catalog" />}>
          <form action={saveCatalog} className="mb-3 grid gap-2 lg:grid-cols-[80px_120px_160px_120px_1fr_auto]">
            <input className="input" name="sequence" type="number" placeholder="№" />
            <input className="input" name="department" placeholder="Хэлтэс" />
            <input className="input" name="orgUnit" placeholder="Нэгж" />
            <input className="input" name="code" placeholder="Код" />
            <input className="input" name="title" placeholder="Хуудасны нэр" required />
            <button className="btn btn-primary" type="submit">Нэмэх</button>
          </form>
          <EditableCatalogTable rows={master.checklistCatalog} />
        </Panel>

        <Panel
          title="Хүснэгт-ХШТөрийн: зөрчил арилгах явц"
          actions={<ExportButtons tableId="state-table" filename="state-inspection-progress" />}>
          <form action={saveState} className="mb-3 grid gap-2 lg:grid-cols-4">
            <input className="input" name="authority" placeholder="Байгууллага" />
            <input className="input" name="checklistNumber" placeholder="Хуудасны дугаар" />
            <input className="input" name="checklistName" placeholder="Хуудасны нэр" required />
            <input className="input" name="executionStatus" placeholder="Гүйцэтгэлийн төлөв" />
            <input className="input" name="inspectionDate" placeholder="Шалгасан огноо" />
            <input className="input" name="responsibleEmployee" placeholder="Хариуцагч" />
            <input className="input" name="progressPercent" type="number" placeholder="Хувь" />
            <button className="btn btn-primary" type="submit">Нэмэх</button>
          </form>
          <EditableStateTable rows={master.stateInspectionRows} />
        </Panel>

        <Panel
          title="Хүснэгт-ХШХамтарсан: Хамтарсан хяналт шалгалтын хуудас"
          actions={<ExportButtons tableId="joint-table" filename="joint-inspection-form" />}>
          <form action={saveJoint} className="mb-3 grid gap-2 lg:grid-cols-[80px_180px_1fr_120px_120px_auto]">
            <input className="input" name="sequence" type="number" placeholder="№" />
            <input className="input" name="category" placeholder="Ангилал" />
            <input className="input" name="item" placeholder="Шалгах үзүүлэлт" required />
            <input className="input" name="maxScore" type="number" step="0.01" placeholder="Дээд оноо" />
            <input className="input" name="score" type="number" step="0.01" placeholder="Оноо" />
            <button className="btn btn-primary" type="submit">Нэмэх</button>
          </form>
          <EditableJointTable rows={master.jointInspectionItems} />
        </Panel>

        <Panel
          title="Хүснэгт-ХШШөнийн: Шөнийн хяналт шалгалтын хуудас"
          actions={<ExportButtons tableId="night-table" filename="night-inspection-form" />}>
          <form action={saveNight} className="mb-3 grid gap-2 lg:grid-cols-[80px_160px_120px_220px_1fr_auto]">
            <input className="input" name="sequence" type="number" placeholder="№" />
            <input className="input" name="area" placeholder="Бүс / хэсэг" />
            <input className="input" name="sectionNo" placeholder="Бүлэг" />
            <input className="input" name="sectionTitle" placeholder="Бүлгийн нэр" />
            <input className="input" name="item" placeholder="Шалгах үзүүлэлт" required />
            <button className="btn btn-primary" type="submit">Нэмэх</button>
          </form>
          <EditableNightTable rows={master.nightInspectionItems} />
        </Panel>
      </div>
    </div>
  );
}

function DeleteButton({ id, kind }: { id?: string; kind: string }) {
  if (!id) return null;
  return (
    <>
      <input type="hidden" name="kind" value={kind} />
      <button className="btn" type="submit" formAction={removeRow}>Устгах</button>
    </>
  );
}

function EditableCatalogTable({ rows }: { rows: ReturnType<typeof readMasterWorkbook>["checklistCatalog"] }) {
  return (
    <TableScroll size="md" maxHeightClass="max-h-[28rem]">
      <table id="catalog-table">
        <thead>
          <tr><th>№</th><th>Хэлтэс</th><th>Нэгж</th><th>Код</th><th>Хуудасны нэр</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td colSpan={6} className="p-0">
                <form action={saveCatalog} className="grid gap-2 p-2 lg:grid-cols-[70px_120px_160px_120px_minmax(260px,1fr)_auto]">
                  <input type="hidden" name="id" value={row.id} />
                  <input className="input" name="sequence" type="number" defaultValue={row.sequence} />
                  <input className="input" name="department" defaultValue={row.department} />
                  <input className="input" name="orgUnit" defaultValue={row.orgUnit} />
                  <input className="input" name="code" defaultValue={row.code} />
                  <textarea className="textarea min-h-10" name="title" defaultValue={row.title} />
                  <div className="flex gap-2">
                    <button className="btn btn-primary" type="submit">Хадгалах</button>
                    <DeleteButton id={row.id} kind="catalog" />
                  </div>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}

function EditableStateTable({ rows }: { rows: ReturnType<typeof readMasterWorkbook>["stateInspectionRows"] }) {
  return (
    <TableScroll size="md" maxHeightClass="max-h-[28rem]">
      <table id="state-table">
        <thead>
          <tr><th>№</th><th>Байгууллага</th><th>Дугаар</th><th>Хуудас</th><th>Зөрчил</th><th>Явц</th><th>Хариуцагч</th><th>Төлөв</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td colSpan={9} className="p-0">
                <form action={saveState} className="grid gap-2 p-2 lg:grid-cols-[60px_140px_100px_minmax(220px,1fr)_100px_100px_160px_160px_auto]">
                  <input type="hidden" name="id" value={row.id} />
                  <input className="input" name="sequence" type="number" defaultValue={row.sequence} />
                  <input className="input" name="authority" defaultValue={row.authority} />
                  <input className="input" name="checklistNumber" defaultValue={row.checklistNumber} />
                  <textarea className="textarea min-h-10" name="checklistName" defaultValue={row.checklistName} />
                  <input className="input" name="violationCountFormulaOrValue" defaultValue={row.violationCountFormulaOrValue} />
                  <input className="input" name="progressPercent" type="number" defaultValue={row.progressPercent ?? 0} />
                  <input className="input" name="responsibleEmployee" defaultValue={row.responsibleEmployee} />
                  <input className="input" name="executionStatus" defaultValue={row.executionStatus} />
                  <div className="flex gap-2">
                    <button className="btn btn-primary" type="submit">Хадгалах</button>
                    <DeleteButton id={row.id} kind="state" />
                  </div>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}

function EditableJointTable({ rows }: { rows: ReturnType<typeof readMasterWorkbook>["jointInspectionItems"] }) {
  return (
    <TableScroll size="md" maxHeightClass="max-h-[28rem]">
      <table id="joint-table">
        <thead>
          <tr><th>№</th><th>Ангилал</th><th>Үзүүлэлт</th><th>Дээд оноо</th><th>Оноо</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td colSpan={6} className="p-0">
                <form action={saveJoint} className="grid gap-2 p-2 lg:grid-cols-[70px_180px_minmax(260px,1fr)_100px_100px_auto]">
                  <input type="hidden" name="id" value={row.id} />
                  <input className="input" name="sequence" type="number" defaultValue={row.sequence} />
                  <input className="input" name="category" defaultValue={row.category} />
                  <textarea className="textarea min-h-10" name="item" defaultValue={row.item} />
                  <input className="input" name="maxScore" type="number" step="0.01" defaultValue={row.maxScore ?? 0} />
                  <input className="input" name="score" type="number" step="0.01" defaultValue={row.score ?? 0} />
                  <div className="flex gap-2">
                    <button className="btn btn-primary" type="submit">Хадгалах</button>
                    <DeleteButton id={row.id} kind="joint" />
                  </div>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}

function EditableNightTable({ rows }: { rows: ReturnType<typeof readMasterWorkbook>["nightInspectionItems"] }) {
  return (
    <TableScroll size="md" maxHeightClass="max-h-[28rem]">
      <table id="night-table">
        <thead>
          <tr><th>№</th><th>Бүс</th><th>Бүлэг</th><th>Бүлгийн нэр</th><th>Үзүүлэлт</th><th>Тайлбар</th><th></th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td colSpan={7} className="p-0">
                <form action={saveNight} className="grid gap-2 p-2 lg:grid-cols-[70px_150px_110px_220px_minmax(260px,1fr)_160px_auto]">
                  <input type="hidden" name="id" value={row.id} />
                  <input className="input" name="sequence" type="number" defaultValue={row.sequence} />
                  <input className="input" name="area" defaultValue={row.area} />
                  <input className="input" name="sectionNo" defaultValue={row.sectionNo} />
                  <input className="input" name="sectionTitle" defaultValue={row.sectionTitle} />
                  <textarea className="textarea min-h-10" name="item" defaultValue={row.item} />
                  <input className="input" name="note" defaultValue={row.note} />
                  <div className="flex gap-2">
                    <button className="btn btn-primary" type="submit">Хадгалах</button>
                    <DeleteButton id={row.id} kind="night" />
                  </div>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  );
}
