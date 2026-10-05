import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/PageHeader";
import { MetricCard, Panel, StatusBadge, TableScroll } from "@/components/ui/primitives";
import { JointRunScoringForm } from "@/components/runs/JointRunScoringForm";
import { RunScoringForm } from "@/components/runs/RunScoringForm";
import {
  getInspectionScope,
  isInspectionReadOnly,
} from "@/lib/access/scope";
import { formatPercent } from "@/lib/scoring";
import { listJointInspectionUnits, listNightInspectionUnits } from "@/lib/runs/joint-units";
import { ensureRunFormAnswers, ensureStoreHydrated, getRunScore } from "@/lib/store";
import {
  ACTION_STATUS_LABELS,
  FINDING_STATUS_LABELS,
  INSPECTION_TYPE_LABELS,
  RUN_STATUS_LABELS,
  SEVERITY_LABELS,
  labelOf,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scope = await getInspectionScope();
  const readOnly = isInspectionReadOnly(scope);
  await ensureStoreHydrated();
  const data = ensureRunFormAnswers(id);
  const run = data.runs.find((r) => r.id === id);
  if (!run) notFound();

  const template = data.templates.find((t) => t.id === run.templateId);
  const score = getRunScore(data, run.id);
  const answers = data.answers.filter((a) => a.runId === run.id);
  const questionMap = new Map(data.questions.map((q) => [q.id, q]));
  const rows = answers
    .map((answer) => ({
      answer,
      question: questionMap.get(answer.templateQuestionId),
    }))
    .sort(
      (a, b) =>
        (a.question?.orderIndex ?? 0) - (b.question?.orderIndex ?? 0),
    );
  const sheetSections = template
    ? data.sections
        .filter((s) => s.templateId === template.id)
        .sort((a, b) => a.orderIndex - b.orderIndex)
    : [];
  const sheetTitle = template
    ? `${template.code} ${template.title}`.trim()
    : run.title;

  const runFindings = data.findings.filter((f) => f.runId === run.id);
  const answerMap = new Map(data.answers.map((answer) => [answer.id, answer]));
  const findingQuestionText = (findingId: string) => {
    const finding = runFindings.find((item) => item.id === findingId);
    const answer = finding?.answerId ? answerMap.get(finding.answerId) : null;
    const question = answer ? questionMap.get(answer.templateQuestionId) : null;
    return question?.questionText || finding?.description || finding?.title || "-";
  };
  const runActions = data.actions.filter((a) =>
    runFindings.some((f) => f.id === a.findingId),
  );
  const sourceRun = run.followUpOfRunId
    ? data.runs.find((item) => item.id === run.followUpOfRunId)
    : null;
  const followUpRuns = data.runs
    .filter((item) => item.followUpOfRunId === run.id)
    .sort((a, b) => b.inspectionDate.localeCompare(a.inspectionDate));
  const isFollowUpRun = run.planMetric === "completed";

  return (
    <div>
      <PageHeader
        title={run.title}
        subtitle={`${INSPECTION_TYPE_LABELS[run.inspectionType]} · ${run.inspectedByOrg} · ${run.inspectionDate}`}
        actions={
          <>
            <Link href="/runs" className="btn">
              Буцах
            </Link>
            {template && !readOnly ? (
              <Link href={`/templates/${template.id}`} className="btn">
                Хуудас
              </Link>
            ) : null}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <StatusBadge tone="brand">{RUN_STATUS_LABELS[run.status]}</StatusBadge>
        <StatusBadge>Эхлүүлсэн: {run.inspectionDate}</StatusBadge>
        <StatusBadge>Дуусгах: {run.dueDate || "—"}</StatusBadge>
        <StatusBadge>Дуусгасан: {run.completedDate || "—"}</StatusBadge>
        {isFollowUpRun ? <StatusBadge tone="ok">Гүйцэтгэлийн ХШ</StatusBadge> : null}
        {template ? (
          <StatusBadge>
            {template.code} · {template.category}
          </StatusBadge>
        ) : null}
      </div>

      <div className="mb-4">
          <Panel title="Гүйцэтгэлийн ХШ холбоос">
            {isFollowUpRun ? (
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Эх ХШ: </span>
                  {sourceRun ? (
                    <Link href={`/runs/${sourceRun.id}`} className="text-[var(--brand-dark)] hover:underline">
                      {sourceRun.title}
                    </Link>
                  ) : (
                    <span className="text-[var(--muted)]">Холбоогүй</span>
                  )}
                </div>
                <div className="rounded-md border border-[var(--border)] bg-slate-50 px-3 py-2 text-[var(--muted)]">
                  {run.followUpNotes || "Гүйцэтгэлийн ХШ хийсэн тухай тэмдэглэл оруулаагүй байна."}
                </div>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {!readOnly ? (
                    <Link
                      href={`/runs/new?followUpOfRunId=${run.id}${run.templateId ? `&templateId=${run.templateId}` : ""}`}
                      className="btn btn-primary"
                    >
                      Гүйцэтгэлийн ХШ үүсгэх
                    </Link>
                  ) : null}
                </div>
                {followUpRuns.length === 0 ? (
                  <div className="rounded-md border border-[var(--border)] bg-slate-50 px-3 py-2 text-[var(--muted)]">
                    Одоогоор гүйцэтгэлийн ХШ холбогдоогүй байна.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {followUpRuns.map((item) => (
                      <li key={item.id} className="rounded border border-[var(--border)] px-3 py-2">
                        <Link href={`/runs/${item.id}`} className="font-medium text-[var(--brand-dark)] hover:underline">
                          {item.title}
                        </Link>
                        <div className="mt-1 text-xs text-[var(--muted)]">
                          {item.inspectionDate} · {RUN_STATUS_LABELS[item.status]}
                        </div>
                        {item.followUpNotes ? (
                          <div className="mt-2 text-xs text-[var(--muted)]">{item.followUpNotes}</div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Panel>
      </div>

      {score ? (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <MetricCard
            label="Хамааралтай"
            value={String(score.applicableQuestionCount)}
          />
          <MetricCard
            label="Хангасан"
            value={String(score.passedQuestionCount)}
            tone="ok"
          />
          <MetricCard
            label="Хангаагүй"
            value={String(score.failedQuestionCount)}
            tone="danger"
          />
          <MetricCard
            label="Нийцэл"
            value={formatPercent(score.compliancePercent)}
            hint={`Хангаагүй ${score.failedScoreTotal} / ${score.approvedScoreTotal}`}
            tone="ok"
          />
          <MetricCard
            label="Эрсдэл"
            value={`${formatPercent(score.riskPercent)} · ${score.riskLevel}`}
            tone={
              score.riskLevel === "Их"
                ? "danger"
                : score.riskLevel === "Дунд"
                  ? "warn"
                  : "brand"
            }
          />
        </div>
      ) : null}

      <div className="mb-4">
        <Panel title="Асуултын оноо">
          {run.inspectionType === "JOINT_INSPECTION" ? (
            <JointRunScoringForm
              runId={run.id}
              runTitle={run.title}
              runStatus={run.status}
              inspectionDate={run.inspectionDate}
              inspectedByOrg={run.inspectedByOrg}
              dueDate={run.dueDate}
              completedDate={run.completedDate}
              rows={rows}
              units={listJointInspectionUnits()}
              initialScopes={run.jointUnitScopes ?? []}
              initialActiveUnitKey={run.activeJointUnitKey}
              initialPerformers={run.performers}
              initialNotes={run.notes}
              initialConfirmationText={run.confirmationText ?? ""}
              unitGroupLabel="Алба / хэсэг / байршил"
              readOnly={readOnly}
              inspectionType="JOINT_INSPECTION"
            />
          ) : run.inspectionType === "NIGHT_INSPECTION" ? (
            <JointRunScoringForm
              runId={run.id}
              runTitle={run.title}
              runStatus={run.status}
              inspectionDate={run.inspectionDate}
              inspectedByOrg={run.inspectedByOrg}
              dueDate={run.dueDate}
              completedDate={run.completedDate}
              rows={rows}
              units={listNightInspectionUnits()}
              initialScopes={run.jointUnitScopes ?? []}
              initialActiveUnitKey={run.activeJointUnitKey}
              initialPerformers={run.performers}
              initialNotes={run.notes}
              initialConfirmationText={run.confirmationText ?? ""}
              unitGroupLabel="Байршил"
              readOnly={readOnly}
              inspectionType="NIGHT_INSPECTION"
            />
          ) : (
            <RunScoringForm
              runId={run.id}
              runStatus={run.status}
              inspectionDate={run.inspectionDate}
              dueDate={run.dueDate}
              completedDate={run.completedDate}
              rows={rows}
              sections={sheetSections}
              sheetTitle={sheetTitle}
              readOnly={readOnly}
              initialPerformers={run.performers}
              initialNotes={run.notes}
              initialConfirmationText={run.confirmationText ?? ""}
            />
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`Зөрчил (${runFindings.length})`}>
          {runFindings.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Зөрчил бүртгээгүй.</p>
          ) : (
            <TableScroll size="md" maxHeightClass="max-h-[22rem]">
              <table className="text-sm">
                <thead>
                  <tr>
                    <th className="min-w-[16rem]">Асуулт / зөрчил</th>
                    <th className="min-w-[10rem]">Гарчиг</th>
                    <th className="min-w-[6rem]">Ноцтол</th>
                    <th className="min-w-[7rem]">Төлөв</th>
                    <th className="min-w-[8rem]">Бодлого</th>
                  </tr>
                </thead>
                <tbody>
                  {runFindings.map((f) => (
                    <tr key={f.id}>
                      <td className="align-top font-medium">
                        {findingQuestionText(f.id)}
                      </td>
                      <td className="align-top text-xs text-[var(--muted)]">
                        {f.title}
                      </td>
                      <td className="align-top">
                        <StatusBadge
                          tone={
                            f.severity === "high" || f.severity === "critical"
                              ? "danger"
                              : "warn"
                          }
                        >
                          {labelOf(SEVERITY_LABELS, f.severity)}
                        </StatusBadge>
                      </td>
                      <td className="align-top">
                        <StatusBadge>
                          {labelOf(FINDING_STATUS_LABELS, f.status)}
                        </StatusBadge>
                      </td>
                      <td className="align-top text-xs">
                        {f.policyClauseId ? (
                          <StatusBadge tone="brand">
                            {f.policyClauseId}
                          </StatusBadge>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </Panel>

        <Panel
          title={`Арга хэмжээ (${runActions.length})`}
          actions={
            <Link href="/actions" className="btn px-2 py-1 text-xs">
              Засах арга хэмжээ
            </Link>
          }
        >
          {runActions.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">
              Арга хэмжээ байхгүй. Оноо өгөөд хадгалсны дараа энд болон sidebar
              дээрх «Засах арга хэмжээ» хуудаст гарна.
            </p>
          ) : (
            <TableScroll size="md" maxHeightClass="max-h-[22rem]">
              <table className="text-sm">
                <thead>
                  <tr>
                    <th className="min-w-[14rem]">Арга хэмжээ</th>
                    <th className="min-w-[14rem]">Холбоотой зөрчил</th>
                    <th className="min-w-[5rem]">Явц</th>
                    <th className="min-w-[7rem]">Төлөв</th>
                    <th className="min-w-[7rem]">Хугацаа</th>
                  </tr>
                </thead>
                <tbody>
                  {runActions.map((a) => (
                    <tr key={a.id}>
                      <td className="align-top font-medium">{a.actionText}</td>
                      <td className="align-top text-xs text-[var(--muted)]">
                        {findingQuestionText(a.findingId)}
                      </td>
                      <td className="align-top tabular-nums">{a.progressPercent}%</td>
                      <td className="align-top">
                        <StatusBadge>
                          {labelOf(ACTION_STATUS_LABELS, a.status)}
                        </StatusBadge>
                      </td>
                      <td className="align-top text-xs tabular-nums">
                        {a.dueDate || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          )}
        </Panel>
      </div>
    </div>
  );
}
