import { PageHeader } from "@/components/layout/PageHeader";
import {
  AnnualPlanByTypeHistory,
  AnnualPlanByTypePanel,
} from "@/components/plans/AnnualPlanByTypePanel";
import { saveAnnualPlanByType } from "@/app/plans/actions";
import { loadPlansPageData } from "@/app/plans/data";
import {
  getInspectionScope,
  isInspectionReadOnly,
} from "@/lib/access/scope";

export const dynamic = "force-dynamic";

export default async function PlansByTypePage() {
  const [{ data, annualPlans, typeTargets, activeRuns, defaultYear }, scope] =
    await Promise.all([loadPlansPageData(), getInspectionScope()]);
  const readOnly = isInspectionReadOnly(scope);

  return (
    <div className="min-w-0">
      <PageHeader
        title="ХШ төрлөөр"
        subtitle={
          readOnly
            ? "Төрлөөр жилийн төлөвлөгөө харах · зөвхөн үзэх эрх"
            : "Төрлөөр жилийн тоо оруулах, түүх харах"
        }
      />

      <div className="space-y-4">
        <AnnualPlanByTypePanel
          targets={typeTargets}
          templates={data.templates}
          defaultYear={defaultYear}
          saveAction={saveAnnualPlanByType}
          readOnly={readOnly}
        />

        <AnnualPlanByTypeHistory
          targets={typeTargets}
          templates={data.templates}
          plans={annualPlans}
          runs={activeRuns}
        />
      </div>
    </div>
  );
}
