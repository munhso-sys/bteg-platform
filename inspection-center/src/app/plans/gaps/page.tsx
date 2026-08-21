import { PageHeader } from "@/components/layout/PageHeader";
import { AnnualPlanCoverageGaps } from "@/components/plans/AnnualPlanCoverageGaps";
import { loadPlansPageData } from "@/app/plans/data";

export const dynamic = "force-dynamic";

export default async function PlansGapsPage() {
  const { data, annualPlans, typeTargets, activeRuns, defaultYear } =
    await loadPlansPageData();

  return (
    <div className="min-w-0">
      <PageHeader
        title="Үлдсэн"
        subtitle="Төлөвлөгөөнд орсон боловч бүртгэгдээгүй хуудас, төрлийн зөрүү"
      />

      <AnnualPlanCoverageGaps
        targets={typeTargets}
        plans={annualPlans}
        templates={data.templates}
        runs={activeRuns}
        defaultYear={defaultYear}
      />
    </div>
  );
}
