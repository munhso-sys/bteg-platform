import { deleteResolvedArchiveRow } from "@/app/actions/mutations";
import { loadActionsPageData } from "@/app/actions/data";
import { ResolvedActionsClient } from "@/components/actions/ResolvedActionsClient";
import { ActionsFindingsCrossLinks } from "@/components/access/RelatedFindingsLinks";
import { PageHeader } from "@/components/layout/PageHeader";
import { ExportButtons } from "@/components/ui/ExportButtons";
import {
  getInspectionScope,
  isInspectionReadOnly,
} from "@/lib/access/scope";

export const dynamic = "force-dynamic";

export default async function ResolvedActionsPage() {
  const [{ resolvedRows }, scope] = await Promise.all([
    loadActionsPageData("resolved"),
    getInspectionScope(),
  ]);
  const readOnly = isInspectionReadOnly(scope);

  return (
    <div className="min-w-0">
      <PageHeader
        title="Арилсан зөрчил"
        subtitle={
          readOnly
            ? "Архив харах · зөвхөн үзэх эрх"
            : "Шийдвэрлэсэн, хаагдсан зөрчлийн архив"
        }
        actions={
          <ExportButtons
            tableId="resolved-actions-table"
            filename="resolved-corrective-actions"
          />
        }
      />
      <ActionsFindingsCrossLinks />
      <ResolvedActionsClient
        resolvedRows={resolvedRows}
        deleteResolvedRow={deleteResolvedArchiveRow}
        readOnly={readOnly}
      />
    </div>
  );
}
