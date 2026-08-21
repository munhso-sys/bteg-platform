import { isFindingResolved } from "@/lib/actions/action-planning";
import {
  getInspectionScope,
  isInspectionReadOnly,
  resolveUnitTemplateIds,
} from "@/lib/access/scope";
import {
  ensureStoreHydrated,
  readAnnualPlans,
  readAnnualPlanTypeTargets,
  readStore,
} from "@/lib/store";
import type {
  AnnualPlanRow,
  AnnualPlanTypeTarget,
  InspectionRun,
  InspectionTemplate,
} from "@/lib/types";

function matchesTemplateByName(
  checklistName: string,
  template: InspectionTemplate,
) {
  const name = checklistName.toLocaleLowerCase();
  const code = template.code.toLocaleLowerCase();
  const title = template.title.toLocaleLowerCase();
  if (!name) return false;
  if (code && (name.startsWith(`${code} -`) || name.startsWith(`${code}-`))) {
    return true;
  }
  if (code && name.includes(code) && name.includes(title)) return true;
  if (title && (name === title || name.includes(title))) return true;
  return false;
}

function planBelongsToUnit(
  row: AnnualPlanRow,
  templateIds: Set<string>,
  templates: InspectionTemplate[],
) {
  if (row.templateId && templateIds.has(row.templateId)) return true;
  for (const template of templates) {
    if (!templateIds.has(template.id)) continue;
    if (matchesTemplateByName(row.checklistName, template)) return true;
  }
  return false;
}

function runBelongsToUnit(
  run: InspectionRun,
  templateIds: Set<string>,
  templates: InspectionTemplate[],
  allowedPlanIds: Set<string>,
) {
  if (run.templateId && templateIds.has(run.templateId)) return true;
  if (run.planId && allowedPlanIds.has(run.planId)) return true;
  for (const template of templates) {
    if (!templateIds.has(template.id)) continue;
    if (matchesTemplateByName(run.title, template)) return true;
  }
  return false;
}

function filterTypeTargetsForUnit(
  targets: AnnualPlanTypeTarget[],
  templateIds: Set<string>,
): AnnualPlanTypeTarget[] {
  return targets.map((target) => {
    const months = target.checklistMonths ?? {};
    const checklistMonths = Object.fromEntries(
      Object.entries(months).filter(([id]) => templateIds.has(id)),
    );
    const checklistCount = Object.values(checklistMonths).reduce(
      (sum, row) => sum + row.filter(Boolean).length,
      0,
    );
    const empty = { quarter: 0, month: 0, shift: 0 };
    return {
      ...target,
      checklistMonths,
      counts: {
        CHECKLIST: {
          quarter: 0,
          month: 0,
          shift: checklistCount,
        },
        NIGHT_INSPECTION: empty,
        JOINT_INSPECTION: empty,
        DOCUMENT_INSPECTION: empty,
        STATE_INSPECTION: empty,
        UNPLANNED_INSPECTION: empty,
      },
      notes: {},
    };
  });
}

export async function loadPlansPageData() {
  await ensureStoreHydrated();
  const scope = await getInspectionScope();
  const unitMode = isInspectionReadOnly(scope);

  // Do not backfill draft runs on GET — was blocking iframe /plans for 30–60s.
  // Draft sync happens on by-type / annual plan saves.

  const data = readStore();
  let annualPlans = readAnnualPlans().sort((a, b) =>
    `${b.year}-${a.checklistName}`.localeCompare(
      `${a.year}-${b.checklistName}`,
    ),
  );
  let typeTargets = readAnnualPlanTypeTargets();
  let templates = data.templates;

  const templateIds = unitMode
    ? await resolveUnitTemplateIds(scope)
    : null;

  if (templateIds) {
    templates = data.templates.filter((t) => templateIds.has(t.id));
    annualPlans = annualPlans.filter((row) =>
      planBelongsToUnit(row, templateIds, data.templates),
    );
    typeTargets = filterTypeTargetsForUnit(typeTargets, templateIds);
  }

  const allowedPlanIds = new Set(annualPlans.map((row) => row.id));

  const findingsByRunId = data.findings.reduce<
    Map<string, typeof data.findings>
  >((map, finding) => {
    const runFindings = map.get(finding.runId) ?? [];
    runFindings.push(finding);
    map.set(finding.runId, runFindings);
    return map;
  }, new Map());
  const archivedRunIds = new Set(
    Array.from(findingsByRunId.entries())
      .filter(
        ([, findings]) =>
          findings.length > 0 &&
          findings.every((finding) => isFindingResolved(finding.status)),
      )
      .map(([runId]) => runId),
  );

  let activeRuns = data.runs.filter((run) => !archivedRunIds.has(run.id));
  if (templateIds) {
    activeRuns = activeRuns.filter((run) =>
      runBelongsToUnit(run, templateIds, data.templates, allowedPlanIds),
    );
  }

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const defaultYear = new Date().getFullYear();

  return {
    data: {
      ...data,
      templates,
      runs: templateIds ? activeRuns : data.runs,
    },
    annualPlans,
    typeTargets,
    activeRuns,
    today,
    defaultYear,
    unitTemplateIds: templateIds,
  };
}
