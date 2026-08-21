import { PageHeader } from "@/components/layout/PageHeader";
import { FindingsOverviewLinks } from "@/components/findings/FindingsOverviewLinks";
import { FindingsActionsCrossLinks } from "@/components/access/RelatedFindingsLinks";
import { formatCount, loadFindingsDashboard } from "@/app/findings/data";
import { INSPECTION_TYPE_LABELS, type InspectionType } from "@/lib/types";

export const dynamic = "force-dynamic";

const OVERVIEW_KPI_TYPES: InspectionType[] = [
  "STATE_INSPECTION",
  "CHECKLIST",
  "NIGHT_INSPECTION",
  "JOINT_INSPECTION",
  "DOCUMENT_INSPECTION",
  "UNPLANNED_INSPECTION",
];

const KPI_TONES = [
  "border-l-[var(--brand)]",
  "border-l-amber-500",
  "border-l-emerald-500",
  "border-l-rose-500",
  "border-l-[var(--brand)]",
  "border-l-amber-500",
] as const;

export default async function FindingsOverviewPage() {
  const dashboard = await loadFindingsDashboard();

  return (
    <div className="min-w-0">
      <PageHeader
        title="Тойм"
        subtitle="Зөрчил / нийцэлгүй байдал — гүйцэтгэл, зөрчил, арга хэмжээ, онооны үзүүлэлтээр"
      />

      <FindingsActionsCrossLinks />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {OVERVIEW_KPI_TYPES.map((type, index) => {
          const counts = dashboard.overview.byType[type];
          return (
            <div
              key={type}
              className={`flex w-full flex-col rounded-md border border-[var(--border)] border-l-4 bg-[var(--card)] px-3 py-2.5 text-left ${KPI_TONES[index]}`}
            >
              <div className="text-[11px] font-medium uppercase tracking-wide text-[var(--muted)]">
                {INSPECTION_TYPE_LABELS[type]}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                    Бүртгэгдсэн
                  </div>
                  <div className="mt-0.5 text-2xl font-semibold leading-none tabular-nums text-[var(--fg)]">
                    {formatCount(counts.registered)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
                    Арилсан
                  </div>
                  <div className="mt-0.5 text-2xl font-semibold leading-none tabular-nums text-emerald-600 dark:text-emerald-400">
                    {formatCount(counts.resolved)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <FindingsOverviewLinks />
    </div>
  );
}
