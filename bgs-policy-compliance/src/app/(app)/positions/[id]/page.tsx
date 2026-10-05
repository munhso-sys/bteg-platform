import { notFound, redirect } from "next/navigation";
import { PositionScoreTrendPanel } from "@/components/charts/position-score-trend-panel";
import { ContextBackLink } from "@/components/policies/policy-back-link";
import { PositionsSubnav } from "@/components/positions/positions-subnav";
import { CollapsiblePanel } from "@/components/ui/collapsible-panel";
import { PageHeader, Panel, ScoreChip } from "@/components/ui/primitives";
import { getPositionDetail } from "@/lib/db/repository";
import { getPolicyScope } from "@/lib/access/scope";
import { isPositionScoped } from "@/lib/access/embed";
import { buildPositionScoreTrend } from "@/lib/score-trend";
import { JobDescriptionEditDialog } from "./job-description-edit-dialog";
import { JobDescriptionEvaluateForm } from "./job-description-evaluate-form";
import { JobDescriptionView } from "./job-description-view";
import { PositionObligationsSection } from "./position-obligations-section";
import { PositionObligationsTree } from "./position-obligations-tree";

export const dynamic = "force-dynamic";

export default async function PositionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    from?: string;
    heltesId?: string;
    albaId?: string;
    tab?: string;
    policyId?: string;
  }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const scope = await getPolicyScope();
  const readOnly = isPositionScoped(scope);

  if (readOnly && scope?.positionId) {
    const { resolveJobPositionRef } = await import(
      "@/lib/access/resolve-position"
    );
    const mine = await resolveJobPositionRef(
      scope.positionId,
      scope.positionName,
    );
    const requested = await resolveJobPositionRef(id);
    const myId = mine?.id ?? scope.positionId;
    const reqId = requested?.id ?? id;
    if (myId !== reqId) {
      redirect(`/positions/${myId}`);
    }
  }

  const detail = await getPositionDetail(id);
  if (!detail) notFound();

  const { points: trendPoints, snapshot: trendSnapshot } =
    buildPositionScoreTrend({
      complianceEvaluations: detail.evaluations,
      descriptionEvaluations: detail.descriptionEvaluations,
    });

  const tScore = detail.descriptionEvaluation?.score ?? null;

  return (
    <div className="min-w-0">
      {!readOnly ? <PositionsSubnav /> : null}
      {!readOnly ? (
        <div className="mb-3">
          <ContextBackLink
            from={sp.from ?? "positions"}
            heltesId={sp.heltesId}
            albaId={sp.albaId}
            tab={sp.tab ?? "positions"}
            policyId={sp.policyId}
          />
        </div>
      ) : null}
      <PageHeader
        title={detail.position.name}
        description={
          readOnly
            ? `Зөвхөн таны ажлын байрт холбогдсон журмын заалт · BTEG ${detail.position.bteg_id || "—"}`
            : `BTEG ${detail.position.bteg_id || "—"} · нэгж ${detail.position.alba_id || detail.position.heltes_id || detail.position.gazar_id || "—"}`
        }
        actions={<ScoreChip score={detail.avgScore} />}
      />

      {/* Шалгах preview-тэй ижил: нэг багана — tablet/phone дээр хажуугийн багана шахагдахгүй */}
      <div className="space-y-3">
        <PositionObligationsSection
          obligations={detail.obligations}
          counts={detail.counts}
        />

        <CollapsiblePanel
          title="Нэгжийн хамрах хүрээний журам"
          defaultOpen={false}
          badge={
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-700">
              {detail.orgScope.policyCount}
            </span>
          }
        >
          <div className="mb-3 space-y-2 rounded border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
            <p className="leading-relaxed">{detail.orgScope.reasonSummary}</p>
            {detail.orgScope.reasonBreakdown.length > 0 ? (
              <ul className="list-disc space-y-0.5 pl-4">
                {detail.orgScope.reasonBreakdown.map((r) => (
                  <li key={r.type}>
                    <span className="font-medium text-slate-800">{r.label}</span>
                    {" — "}
                    {r.policyCount} журам
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-[11px] text-slate-500">
              Эдгээр нь KPI «журам/заалт» тоонд орохгүй · зөвхөн лавлагаа.
            </p>
          </div>
          {detail.orgScope.obligations.length === 0 ? (
            <p className="text-sm text-slate-500">
              Нэгжийн хамрах хүрээнд нэмэлт журам алга.
            </p>
          ) : (
            <div className="min-w-0 overflow-x-auto">
              <PositionObligationsTree rows={detail.orgScope.obligations} />
            </div>
          )}
        </CollapsiblePanel>

        <Panel title="Онооны хандлага">
          <PositionScoreTrendPanel
            points={trendPoints}
            snapshot={trendSnapshot}
          />
        </Panel>

        <CollapsiblePanel
          title="Ажлын байрны тодорхойлолт (АБТ)"
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
          <div className="space-y-3">
            {!readOnly ? (
              <div className="flex justify-end">
                <JobDescriptionEditDialog
                  positionId={id}
                  initial={detail.description}
                />
              </div>
            ) : null}
            {detail.description ? (
              <JobDescriptionView description={detail.description} />
            ) : (
              <p className="text-sm text-slate-500">
                Ажлын байрны тодорхойлолт байхгүй. «АБТ засварлах» дарж
                Загвар.docx бүтцээр үүсгэнэ үү.
              </p>
            )}
          </div>
        </CollapsiblePanel>

        {!readOnly ? (
          <CollapsiblePanel
            title="Т-үнэлгээ (АБТ)"
            defaultOpen={false}
            badge={
              tScore != null ? (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-800">
                  {tScore}
                </span>
              ) : (
                <span className="text-[10px] text-slate-500">—</span>
              )
            }
          >
            <JobDescriptionEvaluateForm
              positionId={id}
              initial={detail.descriptionEvaluation}
            />
          </CollapsiblePanel>
        ) : null}
      </div>
    </div>
  );
}
