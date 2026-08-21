import { PageHeader } from "@/components/layout/PageHeader";
import { MetricCard, Panel, TableScroll } from "@/components/ui/primitives";
import { formatPercent } from "@/lib/scoring";
import { getDashboardMetrics } from "@/lib/store";
import { readScopedStore } from "@/lib/access/scope";
import { INSPECTION_TYPE_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const { data } = await readScopedStore();
  const m = getDashboardMetrics(data);

  const byTemplate = data.runs.reduce<
    Record<string, { title: string; count: number; compliance: number[] }>>((acc, run) => {
    const key = run.templateId ?? "none";
    const template = data.templates.find((t) => t.id === run.templateId);
    const score = data.scoreSnapshots.find((s) => s.runId === run.id);
    if (!acc[key]) {
      acc[key] = {
        title: template ? `${template.code} ${template.title}` : run.title,
        count: 0,
        compliance: [],
      };
    }
    acc[key].count += 1;
    if (score) acc[key].compliance.push(score.compliancePercent);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Шинжилгээ"
        subtitle="Төрөл, хуудас, нийцэл, эрсдэлийн тойм"
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <MetricCard
          label="Нийцэл"
          value={formatPercent(m.compliancePercent)}
          tone="ok"
        />
        <MetricCard
          label="Эрсдэл"
          value={formatPercent(m.riskPercent)}
          tone="warn"
        />
        <MetricCard
          label="Зөрчил шийдвэрлэлт"
          value={`${m.resolvedViolationCount}/${m.violationCount}`}
        />
        <MetricCard
          label="Арга хэмжээ"
          value={formatPercent(m.actionCompletion)}
          tone="brand"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Төрлөөр">
          <TableScroll size="sm" maxHeightClass="max-h-[22rem]">
          <table>
            <thead>
              <tr>
                <th>Төрөл</th>
                <th>Тоо</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(m.byType).map(([type, count]) => (
                <tr key={type}>
                  <td>
                    {INSPECTION_TYPE_LABELS[
                      type as keyof typeof INSPECTION_TYPE_LABELS
                    ] ?? type}
                  </td>
                  <td className="tabular-nums">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </TableScroll>
        </Panel>

        <Panel title="Хуудсаар">
          <TableScroll size="sm" maxHeightClass="max-h-[22rem]">
          <table>
            <thead>
              <tr>
                <th>Хуудас</th>
                <th>Гүйцэтгэл</th>
                <th>Дундаж нийцэл</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(byTemplate).map((row) => (
                <tr key={row.title}>
                  <td className="text-sm">{row.title}</td>
                  <td className="tabular-nums">{row.count}</td>
                  <td className="tabular-nums">
                    {row.compliance.length
                      ? formatPercent(
                          row.compliance.reduce((a, b) => a + b, 0) /
                            row.compliance.length,
                        )
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </TableScroll>
        </Panel>
      </div>
    </div>
  );
}
