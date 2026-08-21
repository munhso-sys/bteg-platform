import { PageHeader } from "@/components/layout/PageHeader";
import { ProgressBar } from "@/components/ProgressBar";
import { MetricCard, Panel } from "@/components/ui/primitives";
import { pillars, resultMetrics } from "@/lib/program-data";

export default function ResultsPage() {
  const average = resultMetrics.length
    ? Math.round(
        resultMetrics.reduce((sum, item) => sum + item.progress, 0) /
          resultMetrics.length,
      )
    : 0;

  return (
    <div>
      <PageHeader
        title="Туршилт, үр дүн"
        subtitle="Хөтөлбөрийн багануудын туршилт, зорилт, бодит гүйцэтгэл"
      />

      <section className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        <MetricCard
          label="Үзүүлэлт"
          value={String(resultMetrics.length)}
          hint="Бүртгэгдсэн үр дүн"
          tone="brand"
        />
        <MetricCard
          label="Дундаж явц"
          value={`${average}%`}
          hint="Зорилттой харьцуулсан"
          tone="ok"
        />
        <MetricCard
          label="Багана"
          value={String(pillars.length)}
          hint="Хөтөлбөрийн чиглэл"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {pillars.map((pillar) => {
          const metrics = resultMetrics.filter((item) => item.pillarId === pillar.id);
          return (
            <Panel
              key={pillar.id}
              title={`${pillar.no}.1 ${pillar.title}`}
              description="Туршилт, үр дүнгийн үзүүлэлт"
            >
              {metrics.length === 0 ? (
                <div className="text-sm text-[var(--muted)]">
                  Одоогоор үзүүлэлт бүртгээгүй.
                </div>
              ) : (
                <div className="space-y-4">
                  {metrics.map((metric) => (
                    <div key={metric.id}>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-semibold">{metric.label}</span>
                        <span className="text-[var(--muted)]">
                          {metric.actual} / {metric.target}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-[var(--muted)]">
                        Хариуцагч: {metric.owner}
                      </div>
                      <div className="mt-2">
                        <ProgressBar value={metric.progress} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
