import { updateActionPlan } from "@/app/actions/mutations";
import { loadActionsPageData } from "@/app/actions/data";
import { OpenActionsClient } from "@/components/actions/OpenActionsClient";
import { ActionsFindingsCrossLinks } from "@/components/access/RelatedFindingsLinks";
import { PageHeader } from "@/components/layout/PageHeader";
import { ExportButtons } from "@/components/ui/ExportButtons";
import {
  getInspectionScope,
  isInspectionReadOnly,
} from "@/lib/access/scope";

export const dynamic = "force-dynamic";

export default async function OpenActionsPage() {
  const [{ rows, severityOptions, statusOptions, typeOptions }, scope] =
    await Promise.all([loadActionsPageData("open"), getInspectionScope()]);
  const readOnly = isInspectionReadOnly(scope);

  return (
    <div className="min-w-0">
      <PageHeader
        title="Арилаагүй зөрчил"
        subtitle={
          readOnly
            ? "Зөрчил, арга хэмжээ харах · зөвхөн үзэх эрх"
            : "Шүүлтүүр, эрсдэлийн үнэлгээ, авах арга хэмжээний төлөвлөгөө"
        }
        actions={
          <ExportButtons
            tableId="actions-plan-table"
            filename="corrective-action-plan"
          />
        }
      />
      <ActionsFindingsCrossLinks />
      <OpenActionsClient
        rows={rows}
        severityOptions={severityOptions}
        statusOptions={statusOptions}
        typeOptions={typeOptions}
        updateAction={updateActionPlan}
        readOnly={readOnly}
      />
    </div>
  );
}
