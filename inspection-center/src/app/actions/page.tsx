import { loadActionsPageData } from "@/app/actions/data";
import { PageHeader } from "@/components/layout/PageHeader";
import { MetricCard, Panel } from "@/components/ui/primitives";
import { ActionsOverviewLinks } from "@/components/actions/ActionsOverviewLinks";
import { ActionsFindingsCrossLinks } from "@/components/access/RelatedFindingsLinks";
import { EmbedLink } from "@/components/access/EmbedLink";
import {
  formatFindingRiskBands,
  normalizeRiskThresholds,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ActionsOverviewPage() {
  const { data, rows } = await loadActionsPageData("overview");
  const thresholds = normalizeRiskThresholds(data.riskThresholds);
  const bands = formatFindingRiskBands(thresholds);
  const criticalHigh = rows.filter(
    (row) => row.riskLabel === "critical" || row.riskLabel === "high",
  ).length;
  const overdue = rows.filter((row) => row.actionStatus === "overdue").length;
  const noAction = rows.filter((row) => row.actionStatus === "no_action").length;
  const avgRisk = rows.length
    ? Math.round(rows.reduce((sum, row) => sum + row.riskScore, 0) / rows.length)
    : 0;

  return (
    <div className="min-w-0">
      <PageHeader
        title="Тойм"
        subtitle="Арилаагүй зөрчил, эрсдлийн үнэлгээ, авах арга хэмжээний үзүүлэлт"
      />

      <ActionsFindingsCrossLinks />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          label="Арилаагүй зөрчил"
          value={String(rows.length)}
          hint="шийдвэрлэсэн/хаагдсан биш"
          tone="brand"
        />
        <MetricCard
          label="Маш их / Их"
          value={String(criticalHigh)}
          hint="Нэгтгэсэн эрсдэлийн оноо"
          tone="danger"
        />
        <MetricCard
          label="Хугацаа хэтэрсэн"
          value={String(overdue)}
          hint="Хугацаа хэтэрсэн хоногоор тооцсон"
          tone="warn"
        />
        <MetricCard
          label="Төлөвлөгөөгүй"
          value={String(noAction)}
          hint="Арга хэмжээ үүсээгүй"
          tone="danger"
        />
        <MetricCard
          label="Дундаж эрсдэл"
          value={`${avgRisk}%`}
          hint="Тохиргооны дүрмээр тооцсон"
          tone="ok"
        />
      </div>

      <Panel
        title="Эрсдэлийн тооцоолол"
        actions={
          <EmbedLink
            href="/settings"
            prefetch={false}
            className="text-xs text-[var(--brand-dark)] hover:underline"
          >
            Тохиргоо
          </EmbedLink>
        }
      >
        <div className="grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-2 lg:grid-cols-4">
          {bands.map((band) => (
            <div key={band.key}>
              {band.label}: {band.range}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-[var(--muted)]">
          Оноог тохиргооны дүрмээр тооцно. Дүрмийг засах: Тохиргоо.
        </p>
      </Panel>

      <ActionsOverviewLinks />
    </div>
  );
}
