import Link from "next/link";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  MetricCard,
  Panel,
  StatusBadge,
  TableScroll,
} from "@/components/ui/primitives";
import { isFindingResolved } from "@/lib/actions/action-planning";
import { formatPercent } from "@/lib/scoring";
import { getDashboardMetrics } from "@/lib/store";
import { readScopedStore } from "@/lib/access/scope";
import {
  INSPECTION_TYPE_LABELS,
  RUN_STATUS_LABELS,
  SEVERITY_LABELS,
  type Severity,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const SEVERITY_RANK: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

function maxSeverity(a: Severity, b: Severity): Severity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

function isListedExecutionRun(
  run: { id: string; status: string },
  answers: { runId: string; answeredAt: string }[],
) {
  if (run.status !== "draft") return true;
  return answers.some(
    (answer) => answer.runId === run.id && Boolean(answer.answeredAt),
  );
}

export default async function DashboardPage() {
  const { data, scope, allocations } = await readScopedStore();
  const m = getDashboardMetrics(data);
  const recentRuns = data.runs
    .filter((run) => isListedExecutionRun(run, data.answers))
    .slice(0, 8);
  const unitLabel = scope?.albaName || scope?.heltesName || null;
  const unitMode = scope?.mode === "unit";
  const allocatedTemplates = allocations.flatMap((a) => a.templates);

  const answerMap = new Map(data.answers.map((answer) => [answer.id, answer]));
  const questionMap = new Map(
    data.questions.map((question) => [question.id, question]),
  );
  const runMap = new Map(data.runs.map((run) => [run.id, run]));
  const templateMap = new Map(
    data.templates.map((template) => [template.id, template]),
  );

  const openViolationGroups = (() => {
    type Group = {
      key: string;
      checklistName: string;
      indicator: string;
      count: number;
      severity: Severity;
    };
    const groups = new Map<string, Group>();

    for (const finding of data.findings) {
      if (isFindingResolved(finding.status)) continue;

      const answer = finding.answerId
        ? answerMap.get(finding.answerId)
        : undefined;
      const question = answer
        ? questionMap.get(answer.templateQuestionId)
        : undefined;
      const run = runMap.get(finding.runId);
      const template =
        (run?.templateId ? templateMap.get(run.templateId) : undefined) ??
        (question ? templateMap.get(question.templateId) : undefined);
      const checklistName = (
        template
          ? [template.code, template.title].filter(Boolean).join(" — ")
          : run?.title || "ХШ хуудас"
      ).trim();
      const indicator = (
        question?.questionText ||
        finding.sourceText ||
        finding.description ||
        finding.title ||
        "—"
      ).trim();
      const key = question?.id
        ? `q:${question.id}`
        : `t:${checklistName.toLocaleLowerCase()}::${indicator.toLocaleLowerCase()}`;

      const existing = groups.get(key);
      if (existing) {
        existing.count += 1;
        existing.severity = maxSeverity(existing.severity, finding.severity);
        if (
          (!existing.indicator || existing.indicator === "—") &&
          indicator &&
          indicator !== "—"
        ) {
          existing.indicator = indicator;
        }
      } else {
        groups.set(key, {
          key,
          checklistName,
          indicator,
          count: 1,
          severity: finding.severity,
        });
      }
    }

    return [...groups.values()]
      .sort(
        (a, b) =>
          b.count - a.count ||
          SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
          a.checklistName.localeCompare(b.checklistName, "mn"),
      )
      .slice(0, 12);
  })();

  return (
    <div>
      <PageHeader
        title="Самбар"
        subtitle={
          unitMode && unitLabel
            ? `Нэгжийн хүрээ: ${unitLabel} · зөвхөн харах эрх`
            : "Хяналт шалгалтын ерөнхий самбар — НҮҮР / ХШХ бүтэцтэй нийцүүлсэн"
        }
        actions={
          unitMode ? undefined : (
            <Link href="/runs/new" className="btn btn-primary">
              Шинэ шалгалт
            </Link>
          )
        }
      />

      {unitMode && allocatedTemplates.length > 0 ? (
        <div className="mb-4">
          <Panel title="Холбогдсон ХШ хуудас">
            <div className="flex flex-wrap gap-1.5">
              {allocatedTemplates.map((t) => (
                <span
                  key={t.id}
                  className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] px-2 py-1 text-xs"
                >
                  {t.code ? `${t.code} · ` : ""}
                  {t.title}
                </span>
              ))}
            </div>
          </Panel>
        </div>
      ) : null}

      {unitMode && allocations.length === 0 ? (
        <div className="mb-4">
          <Panel title="Анхааруулга">
            <p className="text-sm text-[var(--muted)]">
              Таны алба/хэлтэст ХШ хуудас холбоогүй байна. Админ Хяналт шалгалт →
              Тохиргоо → «Алба · ХШ хуудас холбох»-оос тохируулна уу.
            </p>
          </Panel>
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <MetricCard
          label="Шалгалт"
          value={String(m.inspectionCount)}
          hint={`${m.planCount} төлөвлөгөө · ${m.templateCount} хуудас`}
          tone="brand"
        />
        <MetricCard
          label="Зөрчил"
          value={String(m.violationCount)}
          hint={`${m.resolvedViolationCount} шийдвэрлэсэн`}
          tone="danger"
        />
        <MetricCard
          label="Нийцэл"
          value={formatPercent(m.compliancePercent)}
          hint="Дундаж нийцлийн хувь"
          tone="ok"
        />
        <MetricCard
          label="Эрсдэл"
          value={formatPercent(m.riskPercent)}
          hint="Дундаж эрсдэлийн хувь"
          tone="warn"
        />
        <MetricCard
          label="Арга хэмжээний явц"
          value={formatPercent(m.actionProgress)}
          hint={`Биелэлт: ${formatPercent(m.actionCompletion)}`}
        />
        <MetricCard
          label="Нотлох баримт"
          value={String(m.evidenceCount)}
          hint="Хавсаргасан баримт"
        />
        <MetricCard
          label="Хяналтын хуудас"
          value={String(m.templateCount)}
          hint="Импортлогдсон хуудсууд"
          tone="brand"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Сүүлийн шалгалтууд"
          actions={
            <Link
              href="/runs"
              className="text-xs font-medium text-[var(--brand-dark)] hover:underline"
            >
              Гүйцэтгэл →
            </Link>
          }
        >
          <TableScroll size="sm" maxHeightClass="max-h-[22rem]">
            <table>
              <thead>
                <tr>
                  <th className="col-text-primary">Гарчиг</th>
                  <th className="col-text-secondary">Төрөл</th>
                  <th className="col-narrow-sm">Огноо</th>
                  <th className="col-narrow">Төлөв</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-sm text-[var(--muted)]">
                      Шалгалт байхгүй байна.{" "}
                      <Link href="/runs" className="text-[var(--brand-dark)] hover:underline">
                        Шалгалтын гүйцэтгэл
                      </Link>
                    </td>
                  </tr>
                ) : (
                  recentRuns.map((run) => (
                    <tr key={run.id}>
                      <td className="col-text-primary" title={run.title}>
                        <Link
                          href={`/runs/${run.id}`}
                          className="cell-ellipsis text-[11px] font-medium leading-snug text-[var(--brand-dark)] hover:underline"
                        >
                          {run.title}
                        </Link>
                      </td>
                      <td
                        className="col-text-secondary text-sm"
                        title={INSPECTION_TYPE_LABELS[run.inspectionType]}
                      >
                        <span className="cell-ellipsis">
                          {INSPECTION_TYPE_LABELS[run.inspectionType]}
                        </span>
                      </td>
                      <td className="col-narrow-sm text-sm tabular-nums">
                        {run.inspectionDate}
                      </td>
                      <td className="col-narrow">
                        <StatusBadge
                          tone={
                            run.status === "completed" ||
                            run.status === "submitted"
                              ? "ok"
                              : run.status === "in_progress"
                                ? "brand"
                                : "neutral"
                          }
                        >
                          {RUN_STATUS_LABELS[run.status]}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableScroll>
        </Panel>

        <Panel title="Нээлттэй зөрчлүүд">
          <TableScroll
            size="sm"
            maxHeightClass="max-h-[22rem]"
            className="[--table-min-width:0px]"
          >
            <table
              className="open-findings-table w-full table-auto"
              style={{ minWidth: 0 }}
            >
              <colgroup>
                <col className="w-auto" />
                <col className="w-[1%]" />
                <col className="w-[28%]" />
              </colgroup>
              <thead>
                <tr>
                  <th>Үзүүлэлт</th>
                  <th className="whitespace-nowrap">Утга</th>
                  <th>ХШ хуудас</th>
                </tr>
              </thead>
              <tbody>
                {openViolationGroups.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-sm text-[var(--muted)]">
                      Нээлттэй зөрчил байхгүй.
                    </td>
                  </tr>
                ) : (
                  openViolationGroups.map((row) => (
                    <tr key={row.key}>
                      <td className="min-w-0 align-middle" title={row.indicator}>
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="min-w-0 truncate text-sm font-medium">
                            {row.indicator}
                          </span>
                          <StatusBadge
                            tone={
                              row.severity === "critical" ||
                              row.severity === "high"
                                ? "danger"
                                : row.severity === "medium"
                                  ? "warn"
                                  : "neutral"
                            }
                          >
                            {SEVERITY_LABELS[row.severity]}
                          </StatusBadge>
                        </div>
                      </td>
                      <td className="whitespace-nowrap align-middle tabular-nums font-semibold">
                        {row.count}
                      </td>
                      <td
                        className="min-w-0 align-middle"
                        title={row.checklistName}
                      >
                        <Link
                          href="/findings"
                          className="block truncate text-[11px] leading-tight text-[var(--muted)] hover:underline"
                        >
                          {row.checklistName}
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </TableScroll>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Төрлөөр">
          <div className="flex flex-wrap gap-2">
            {Object.entries(m.byType).length === 0 ? (
              <span className="text-sm text-[var(--muted)]">Мэдээлэлгүй</span>
            ) : (
              Object.entries(m.byType).map(([type, count]) => (
                <StatusBadge key={type} tone="brand">
                  {INSPECTION_TYPE_LABELS[
                    type as keyof typeof INSPECTION_TYPE_LABELS
                  ] ?? type}
                  : {count}
                </StatusBadge>
              ))
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
