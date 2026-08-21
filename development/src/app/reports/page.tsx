import { FileText } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { MetricCard, Panel } from "@/components/ui/primitives";
import { pillars, voiceReports } from "@/lib/program-data";

export default function ReportsPage() {
  const completed = voiceReports.filter((item) => item.status === "completed").length;
  const participants = voiceReports.reduce(
    (sum, item) => sum + item.participants,
    0,
  );

  return (
    <div>
      <PageHeader
        title="Судалгааны тайлан"
        subtitle="Судалгааны явц, оролцогч, хариуцагч, хүлээлгэсэн огноо"
      />

      <section className="mb-5 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
        <MetricCard
          label="Тайлан"
          value={String(voiceReports.length)}
          hint="Бүртгэгдсэн тайлан"
          tone="brand"
        />
        <MetricCard
          label="Дууссан"
          value={String(completed)}
          hint="Баталгаажсан"
          tone="ok"
        />
        <MetricCard
          label="Оролцогч"
          value={String(participants)}
          hint="Нийт хамрагдсан"
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {pillars.map((pillar) => {
          const reports = voiceReports.filter((item) => item.pillarId === pillar.id);
          return (
            <Panel
              key={pillar.id}
              title={`${pillar.no}.2 ${pillar.title}`}
              description="Судалгааны явц, тайлан"
            >
              {reports.length === 0 ? (
                <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
                  <FileText size={15} />
                  Тайлан бүртгэх боломжтой.
                </div>
              ) : (
                <div className="space-y-2">
                  {reports.map((report) => (
                    <div
                      key={report.id}
                      className="rounded border border-[var(--border)] p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">
                            {report.no}. {report.title}
                          </div>
                          <div className="mt-1 text-xs text-[var(--muted)]">
                            {report.participants} оролцогч · {report.responsible} ·{" "}
                            {report.submittedAt}
                          </div>
                        </div>
                        <StatusBadge status={report.status} />
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
