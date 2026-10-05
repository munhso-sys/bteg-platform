import Link from "next/link";
import { getPositionDetail } from "@/lib/db/repository";
import { getPolicyScope } from "@/lib/access/scope";
import { PageHeader, Panel, ScoreChip, KpiCard } from "@/components/ui/primitives";
import { PositionObligationsTree } from "@/app/(app)/positions/[id]/position-obligations-tree";
import { PositionScoreTrendPanel } from "@/components/charts/position-score-trend-panel";
import { buildPositionScoreTrend } from "@/lib/score-trend";

export const dynamic = "force-dynamic";

export default async function MyObligationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    position_id?: string;
    position_name?: string;
    scope?: string;
  }>;
}) {
  const sp = await searchParams;
  const scope = await getPolicyScope();
  const rawPositionId = scope?.positionId || sp.position_id || null;
  const positionName = scope?.positionName || sp.position_name || null;

  if (!rawPositionId && !positionName) {
    return (
      <div>
        <PageHeader
          title="Миний журмын үүрэг"
          description="Ажлын байр холбогдоогүй тул журмын заалт харагдахгүй."
        />
        <Panel title="Анхааруулга">
          <p className="text-sm text-slate-600">
            Таны профайл дээр ажлын байр тохируулаагүй байна. Админ/ДХШХ-аас
            нэвтрэх хүсэлтээр ажлын байр оноолгоо хийлгэнэ үү.
          </p>
        </Panel>
      </div>
    );
  }

  const { resolveJobPositionRef } = await import(
    "@/lib/access/resolve-position"
  );
  const resolved = await resolveJobPositionRef(rawPositionId, positionName);
  const positionId = resolved?.id ?? rawPositionId;

  if (!positionId) {
    return (
      <div>
        <PageHeader
          title="Миний журмын үүрэг"
          description={positionName || "—"}
        />
        <Panel title="Анхааруулга">
          <p className="text-sm text-slate-600">
            Ажлын байр олдсонгүй эсвэл идэвхгүй байна. Админтай холбогдоно уу.
          </p>
        </Panel>
      </div>
    );
  }

  const detail = await getPositionDetail(positionId);
  if (!detail) {
    return (
      <div>
        <PageHeader
          title="Миний журмын үүрэг"
          description={positionName || positionId}
        />
        <Panel title="Анхааруулга">
          <p className="text-sm text-slate-600">
            Ажлын байр олдсонгүй эсвэл идэвхгүй байна. Админтай холбогдоно уу.
          </p>
        </Panel>
      </div>
    );
  }

  const { points: trendPoints, snapshot: trendSnapshot } =
    buildPositionScoreTrend({
      complianceEvaluations: detail.evaluations,
      descriptionEvaluations: detail.descriptionEvaluations,
    });

  return (
    <div>
      <PageHeader
        title="Миний журмын үүрэг"
        description={`${detail.position.name} · зөвхөн таны ажлын байрт холбогдсон заалт`}
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

      <div className="mb-3 text-sm text-slate-600">
        Холбогдсон журам:{" "}
        {detail.policies.length === 0
          ? "байхгүй"
          : detail.policies.map((p) => (
              <Link
                key={p.id}
                href={`/policies/${p.id}`}
                className="mr-2 text-orange-700 hover:underline"
              >
                {p.name}
              </Link>
            ))}
      </div>

      <div className="space-y-3">
        <Panel title="Журмын заалт / үүрэг">
          <PositionObligationsTree rows={detail.obligations} />
        </Panel>
        <Panel title="Онооны хандлага">
          <PositionScoreTrendPanel
            points={trendPoints}
            snapshot={trendSnapshot}
          />
        </Panel>
      </div>
    </div>
  );
}
