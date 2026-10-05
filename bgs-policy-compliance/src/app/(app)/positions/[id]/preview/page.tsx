import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PositionScoreTrendPanel } from "@/components/charts/position-score-trend-panel";
import { PositionsSubnav } from "@/components/positions/positions-subnav";
import { PositionsReviewToolbar } from "@/components/positions/positions-review-toolbar";
import { CollapsiblePanel } from "@/components/ui/collapsible-panel";
import { PageHeader, Panel, ScoreChip, KpiCard } from "@/components/ui/primitives";
import { getPositionDetail } from "@/lib/db/repository";
import { listPositionsForReview } from "@/lib/db/org";
import { buildPositionScoreTrend } from "@/lib/score-trend";
import { JobDescriptionView } from "../job-description-view";
import { PositionObligationsTree } from "../position-obligations-tree";

export const dynamic = "force-dynamic";

export default async function PositionPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await getPositionDetail(id);
  if (!detail) notFound();

  const reviewRows = await listPositionsForReview();
  const row = reviewRows.find((r) => r.id === id);
  const scope = row
    ? {
        organization: row.organization_name.trim() || "__none__",
        heltesId: row.heltesId,
        albaId: row.albaId,
      }
    : {};

  const { points: trendPoints, snapshot: trendSnapshot } =
    buildPositionScoreTrend({
      complianceEvaluations: detail.evaluations,
      descriptionEvaluations: detail.descriptionEvaluations,
    });

  return (
    <div className="min-w-0">
      <PositionsSubnav />
      <div className="mb-2">
        <Link
          href="/positions/review"
          className="inline-flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-sm hover:bg-[var(--surface-muted)]"
        >
          <ArrowLeft size={16} />
          Шалгах жагсаалт
        </Link>
      </div>
      <PageHeader
        title={detail.position.name}
        description={`Албан тушаалын код: ${detail.position.official_code || "—"} · BTEG ${detail.position.bteg_id || "—"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ScoreChip score={detail.avgScore} />
            <PositionsReviewToolbar
              scope={scope}
              positionId={id}
              downloadBaseName={detail.position.name}
            />
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        <KpiCard label="Ж-үнэлгээ" value={row?.policy_avg_score ?? "—"} />
        <KpiCard label="Журмын тоо" value={row?.policy_count ?? detail.counts.policies} />
        <KpiCard label="Заалтын тоо" value={row?.clause_count ?? detail.counts.clauses} />
        <KpiCard
          label="Т-үнэлгээ"
          value={
            detail.descriptionEvaluation?.score ??
            row?.description_score ??
            "—"
          }
        />
      </div>

      <div className="space-y-3">
        <Panel title="Журмын үүрэг (үзэх)">
          <div className="min-w-0 overflow-x-auto">
            <PositionObligationsTree rows={detail.obligations} />
          </div>
        </Panel>
        <Panel title="Онооны хандлага">
          <PositionScoreTrendPanel
            points={trendPoints}
            snapshot={trendSnapshot}
          />
        </Panel>
        <CollapsiblePanel
          title="Ажлын байрны тодорхойлолт"
          defaultOpen={false}
          badge={
            detail.description ? (
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800">
                Бий
              </span>
            ) : (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                Алга
              </span>
            )
          }
        >
          {detail.description ? (
            <JobDescriptionView description={detail.description} />
          ) : (
            <p className="text-sm text-[var(--muted)]">Тодорхойлолт байхгүй.</p>
          )}
        </CollapsiblePanel>
      </div>
    </div>
  );
}
