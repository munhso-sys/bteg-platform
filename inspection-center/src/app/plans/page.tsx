import Link from "next/link";
import { AlertTriangle, ClipboardList, FileStack } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { MetricCard } from "@/components/ui/primitives";
import { loadPlansPageData } from "@/app/plans/data";
import {
  ANNUAL_PLAN_TYPE_ORDER,
  countChecklistMonthSelections,
  normalizeChecklistMonths,
  normalizeRunExecutionStatus,
  type AnnualPlanTypeTarget,
  type InspectionRun,
} from "@/lib/types";

export const dynamic = "force-dynamic";

function planRowTotal(row: { months: Record<string, number> }) {
  return Object.values(row.months).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0,
  );
}

function runBelongsToYear(run: InspectionRun, year: number) {
  const stamp =
    run.inspectionDate || run.completedDate || run.createdAt || "";
  return stamp.startsWith(String(year));
}

/** Listed on Шалгалтын гүйцэтгэл (draft placeholders excluded). */
function isInExecutionList(
  run: InspectionRun,
  answers: { runId: string; answeredAt: string }[],
) {
  if (run.status !== "draft") return true;
  return answers.some(
    (answer) => answer.runId === run.id && Boolean(answer.answeredAt),
  );
}

/**
 * Үлдсэн = төлөвлөсөн Хяналт шалгалтын хуудас − гүйцэтгэлд орсон ХШ тоо.
 * Төлөвлөгөө: Төрлөөр checklist сарын сонголт; гүйцэтгэл: /runs жагсаалтын CHECKLIST.
 */
function countRemainingChecklists(
  year: number,
  targets: AnnualPlanTypeTarget[],
  runs: InspectionRun[],
  answers: { runId: string; answeredAt: string }[],
) {
  const selectedTarget = targets.find((row) => row.year === year) ?? null;
  const planned = countChecklistMonthSelections(
    normalizeChecklistMonths(selectedTarget?.checklistMonths),
  );
  const entered = runs.filter(
    (run) =>
      run.inspectionType === "CHECKLIST" &&
      runBelongsToYear(run, year) &&
      isInExecutionList(run, answers),
  ).length;
  return Math.max(0, planned - entered);
}

const LINKS = [
  {
    href: "/plans/by-type",
    title: "Төрлөөр оруулах",
    body: "ХШ төрлөөр жилийн тоо, сар сонгох",
    icon: ClipboardList,
  },
  {
    href: "/plans/annual",
    title: "Хуудас нэмэх",
    body: "Хяналтын хуудасны жилийн төлөвлөгөө бүртгэх",
    icon: FileStack,
  },
  {
    href: "/plans/gaps",
    title: "Үлдсэн харах",
    body: "Төлөвлөгөө болон бүртгэлийн зөрүү",
    icon: AlertTriangle,
  },
] as const;

export default async function PlansOverviewPage() {
  const { getInspectionScope, isInspectionReadOnly } = await import(
    "@/lib/access/scope"
  );
  const [{ data, annualPlans, typeTargets, activeRuns, defaultYear }, scope] =
    await Promise.all([loadPlansPageData(), getInspectionScope()]);
  const readOnly = isInspectionReadOnly(scope);

  const yearPlans = annualPlans.filter((row) => row.year === defaultYear);
  const pagePlanned = yearPlans.reduce((sum, row) => sum + planRowTotal(row), 0);
  const yearTarget = typeTargets.find((row) => row.year === defaultYear);
  const typePlanned = yearTarget
    ? ANNUAL_PLAN_TYPE_ORDER.reduce(
        (sum, type) => sum + (yearTarget.counts[type]?.shift ?? 0),
        0,
      )
    : 0;
  const plannedCount = typePlanned || pagePlanned;
  const executedCount = activeRuns.filter((run) => {
    if (normalizeRunExecutionStatus(run.status) !== "completed") return false;
    const date = run.inspectionDate || run.createdAt || "";
    return date.startsWith(String(defaultYear));
  }).length;
  const remainingCount = countRemainingChecklists(
    defaultYear,
    typeTargets,
    activeRuns,
    data.answers,
  );

  const links = readOnly
    ? [
        {
          href: "/plans/by-type",
          title: "Төрлөөр харах",
          body: "ХШ төрлөөр жилийн төлөвлөгөө",
          icon: ClipboardList,
        },
        {
          href: "/plans/annual",
          title: "Хуудсаар харах",
          body: "Хяналтын хуудасны жилийн төлөвлөгөө",
          icon: FileStack,
        },
        {
          href: "/plans/gaps",
          title: "Үлдсэн харах",
          body: "Төлөвлөгөө болон бүртгэлийн зөрүү",
          icon: AlertTriangle,
        },
      ]
    : LINKS;

  return (
    <div className="min-w-0">
      <PageHeader
        title="Тойм"
        subtitle={
          readOnly
            ? `${defaultYear} оны төлөвлөгөө, гүйцэтгэл · зөвхөн үзэх эрх`
            : `${defaultYear} оны жилийн төлөвлөгөө, гүйцэтгэл, үлдсэн`
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard
          label="Төлөвлөгөөт"
          value={String(plannedCount)}
          hint={
            typePlanned && pagePlanned && typePlanned !== pagePlanned
              ? `${pagePlanned} хуудсаар бүртгэсэн`
              : `${defaultYear} он`
          }
          tone="brand"
        />
        <MetricCard
          label="Гүйцэтгэл"
          value={String(executedCount)}
          hint="Дууссан шалгалт"
          tone="ok"
        />
        <MetricCard
          label="Үлдсэн"
          value={String(remainingCount)}
          hint="Төлөвлөсөн ХШ хуудас − гүйцэтгэлд орсон"
          tone={remainingCount > 0 ? "warn" : "ok"}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-start gap-3 rounded-md border border-[var(--border)] bg-[var(--card)] px-3 py-3 transition hover:border-[var(--brand)]"
            >
              <Icon
                size={18}
                className="mt-0.5 shrink-0 text-[var(--brand)]"
                aria-hidden
              />
              <span>
                <span className="block text-sm font-semibold text-[var(--fg)]">
                  {item.title}
                </span>
                <span className="mt-1 block text-sm text-[var(--muted)]">
                  {item.body}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
