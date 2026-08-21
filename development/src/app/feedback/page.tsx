import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { MetricCard, Panel } from "@/components/ui/primitives";
import { feedbackItems } from "@/lib/program-data";

export default function FeedbackPage() {
  const total = feedbackItems.reduce((sum, item) => sum + item.count, 0);

  return (
    <div>
      <PageHeader
        title="Санал асуулга"
        subtitle="Санал, асуулга, тунгаалт, оролцооны бүртгэл"
      />

      <section className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
        <MetricCard
          label="Нийт бүртгэл"
          value={String(total)}
          hint="Санал, асуулга, оролцоо"
          tone="brand"
        />
        {feedbackItems.map((item) => (
          <MetricCard
            key={item.id}
            label={item.title}
            value={String(item.count)}
            hint={item.department}
          />
        ))}
      </section>

      <div className="grid gap-3 lg:grid-cols-3">
        {feedbackItems.map((item, index) => (
          <Panel
            key={item.id}
            title={`${index === 0 ? "4" : `4.${index}`} ${item.title}`}
          >
            <div className="text-2xl font-semibold tabular-nums">{item.count}</div>
            <div className="mt-1 text-sm text-[var(--muted)]">
              Холбогдох нэгж: {item.department}
            </div>
            <div className="mt-4">
              <StatusBadge status={item.status} />
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
