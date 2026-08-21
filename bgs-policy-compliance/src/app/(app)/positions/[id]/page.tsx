import { notFound, redirect } from "next/navigation";
import { ScoreTrendChart } from "@/components/charts/charts";
import { ContextBackLink } from "@/components/policies/policy-back-link";
import { PageHeader, Panel, ScoreChip, KpiCard } from "@/components/ui/primitives";
import { RESPONSIBILITY_LABELS } from "@/lib/constants";
import { getPositionDetail } from "@/lib/db/repository";
import { getPolicyScope } from "@/lib/access/scope";
import { isPositionScoped } from "@/lib/access/embed";
import { JobDescriptionForm } from "./job-description-form";
import { JobDescriptionView } from "./job-description-view";
import { PositionObligationsTree } from "./position-obligations-tree";
import { QuickEvaluateForm } from "./quick-evaluate-form";

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

  const trend = [...detail.evaluations]
    .reverse()
    .slice(-20)
    .map((e) => ({
      at: e.evaluated_at.slice(0, 10),
      score: e.score,
    }));

  return (
    <div>
      {!readOnly ? (
        <div className="mb-3">
          <ContextBackLink
            from={sp.from ?? "positions"}
            heltesId={sp.heltesId}
            albaId={sp.albaId}
            tab={sp.tab ?? "positions"}
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

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Зүйл" value={detail.counts.clauses} />
        <KpiCard label="Журам" value={detail.counts.policies} />
        <KpiCard label="Гүйцэтгэх" value={detail.counts.implementation} />
        <KpiCard label="Хянах" value={detail.counts.monitoring} />
        <KpiCard label="Баталгаажуулах" value={detail.counts.verification} />
        <KpiCard label="Нэвтрүүлэх" value={detail.counts.deployment} />
      </div>

      <div className={readOnly ? "space-y-3" : "grid gap-3 lg:grid-cols-[1fr_320px]"}>
        <div className="space-y-3">
          <Panel title="Журмын үүрэг">
            <PositionObligationsTree rows={detail.obligations} />
          </Panel>

          <Panel title="Онооны хандлага">
            {trend.length === 0 ? (
              <p className="text-sm text-slate-500">Үнэлгээ байхгүй.</p>
            ) : (
              <ScoreTrendChart data={trend} />
            )}
          </Panel>

          <Panel title="Ажлын байрны тодорхойлолт (АБТ)">
            {detail.description ? (
              <JobDescriptionView description={detail.description} />
            ) : (
              <p className="text-sm text-slate-500">
                Ажлын байрны тодорхойлолт байхгүй.
              </p>
            )}
          </Panel>
        </div>

        {!readOnly ? (
          <div className="space-y-3">
            <Panel title="Түргэн үнэлгээ">
              <QuickEvaluateForm
                positionId={id}
                obligations={detail.obligations.map((o) => ({
                  clause_id: o.link.policy_clause_id,
                  type: o.link.responsibility_type,
                  label: `${o.clause?.reference_number || "—"} · ${RESPONSIBILITY_LABELS[o.link.responsibility_type]}`,
                }))}
              />
            </Panel>
            <Panel title="АБТ засварлах">
              <JobDescriptionForm
                positionId={id}
                initial={detail.description}
              />
            </Panel>
          </div>
        ) : null}
      </div>
    </div>
  );
}
