import { PageHeader } from "@/components/layout/PageHeader";
import { AnnualPlanForm } from "@/components/plans/AnnualPlanForm";
import { AnnualPlanSummaryTable } from "@/components/plans/AnnualPlanSummaryTable";
import { ExportButtons } from "@/components/ui/ExportButtons";
import { Panel } from "@/components/ui/primitives";
import { saveAnnualPlan } from "@/app/plans/actions";
import { loadPlansPageData } from "@/app/plans/data";
import {
  getInspectionScope,
  isInspectionReadOnly,
} from "@/lib/access/scope";

export const dynamic = "force-dynamic";

export default async function PlansAnnualPage() {
  const [{ data, annualPlans, activeRuns, today, unitTemplateIds }, scope] =
    await Promise.all([loadPlansPageData(), getInspectionScope()]);
  const readOnly = isInspectionReadOnly(scope);
  const noAllocation =
    readOnly && unitTemplateIds != null && unitTemplateIds.size === 0;

  return (
    <div className="min-w-0">
      <PageHeader
        title="Хуудасны төлөвлөгөө"
        subtitle={
          readOnly
            ? "Зөвхөн танай алба/хэлтэст холбосон ХШ хуудас · үзэх эрх"
            : "Хяналтын хуудасны жилийн төлөвлөгөө нэмэх, гүйцэтгэл харах"
        }
        actions={
          <ExportButtons
            tableId="annual-plan-table"
            filename="annual-inspection-plan"
          />
        }
      />

      <div className="space-y-4">
        {noAllocation ? (
          <Panel title="Анхааруулга">
            <p className="text-sm text-[var(--muted)]">
              Таны алба/хэлтэст ХШ хуудас холбоогүй байна. Админ Хяналт шалгалт →
              Тохиргоо → «Алба · ХШ хуудас холбох»-оос тохируулна уу.
            </p>
          </Panel>
        ) : null}

        {!readOnly ? (
          <Panel title="Ерөнхий жилийн төлөвлөгөө нэмэх">
            <AnnualPlanForm action={saveAnnualPlan} templates={data.templates} />
          </Panel>
        ) : null}

        <Panel title="Жилийн ерөнхий төлөвлөгөө ба гүйцэтгэл">
          <AnnualPlanSummaryTable
            rows={annualPlans}
            runs={activeRuns}
            answers={data.answers}
            scores={data.scoreSnapshots}
            today={today}
            readOnly={readOnly}
          />
        </Panel>
      </div>
    </div>
  );
}
