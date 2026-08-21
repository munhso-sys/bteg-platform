import { getRunScore } from "@/lib/store";
import type {
  CorrectiveAction,
  InspectionAnswer,
  InspectionCenterData,
  InspectionFinding,
  InspectionRun,
  InspectionScoreSnapshot,
  InspectionTemplate,
  InspectionTemplateQuestion,
  JointInspectionItem,
  MasterWorkbookData,
  NightInspectionItem,
  StateInspectionProgressRow,
} from "@/lib/types";

type FindingContext = {
  finding: InspectionFinding;
  run: InspectionRun;
  answer: InspectionAnswer | null;
  question: InspectionTemplateQuestion | null;
  action: CorrectiveAction | null;
};

export type LiveStateRow = {
  id: string;
  authority: string;
  checklistNumber: string;
  inspectionCount: number;
  displayNo: number;
  implementationPercent: number | null;
  checklistName: string;
  inspectionDate: string;
  executionStatus: string;
  violationCount: number;
  openCount: number;
  resolvedCount: number;
  riskPercent: number | null;
};

export type LiveStateItemRow = {
  key: string;
  authorityKey: string;
  authority: string;
  checklistKey: string;
  checklistNumber: string;
  checklistName: string;
  displayNo: number;
  questionNo: string;
  item: string;
  violationCount: number;
  openCount: number;
  resolvedCount: number;
  resolvedPercent: number | null;
};

export type LiveStateAuthorityRow = {
  key: string;
  name: string;
  violationCount: number;
  openCount: number;
  resolvedCount: number;
  resolvedPercent: number | null;
};

export type LiveMonthlyRow = {
  monthKey: string;
  monthLabel: string;
  inspectionCount: number;
  violationCount: number;
  resolvedCount: number;
  resolvedPercent: number | null;
};

export type LiveCountedRow = {
  key: string;
  item: string;
  count: number;
  resolvedCount: number;
  resolvedPercent: number | null;
};

export type LiveJointCategoryRow = {
  key: string;
  code: string;
  name: string;
  violationCount: number;
  sharePercent: number | null;
  resolvedCount: number;
  resolvedPercent: number | null;
};

export type LiveJointItemRow = {
  key: string;
  sequence: number;
  categoryKey: string;
  categoryName: string;
  item: string;
  violationCount: number;
  openCount: number;
  resolvedCount: number;
  resolvedPercent: number | null;
};

export type LiveJointUnitRow = {
  key: string;
  unit: string;
  totalCount: number;
  resolvedCount: number;
  resolvedPercent: number | null;
};

export type LiveNightAreaRow = {
  key: string;
  name: string;
  violationCount: number;
  openCount: number;
  resolvedCount: number;
  resolvedPercent: number | null;
};

export type LiveNightItemRow = {
  key: string;
  sequence: number;
  areaKey: string;
  areaName: string;
  sectionNo: string;
  sectionTitle: string;
  item: string;
  isViolationIndicator: boolean;
  violationCount: number;
  openCount: number;
  resolvedCount: number;
  resolvedPercent: number | null;
};

export type LiveSidebarDashboard = {
  /** All ХШ types from Шалгалтын гүйцэтгэл filters — findings only, not run placeholders. */
  overview: {
    totalViolations: number;
    resolvedViolations: number;
    byType: Record<
      | "STATE_INSPECTION"
      | "CHECKLIST"
      | "NIGHT_INSPECTION"
      | "JOINT_INSPECTION"
      | "DOCUMENT_INSPECTION"
      | "UNPLANNED_INSPECTION",
      { registered: number; resolved: number }
    >;
  };
  state: {
    totalChecklists: number;
    totalRuns: number;
    totalFollowUpRuns: number;
    totalViolations: number;
    resolvedViolations: number;
    rows: LiveStateRow[];
    authorities: LiveStateAuthorityRow[];
    items: LiveStateItemRow[];
  };
  night: {
    totalRuns: number;
    totalFollowUpRuns: number;
    totalViolations: number;
    resolvedViolations: number;
    resolvedPercent: number | null;
    monthly: LiveMonthlyRow[];
    areas: LiveNightAreaRow[];
    items: LiveNightItemRow[];
    mismatches: LiveCountedRow[];
  };
  joint: {
    totalRuns: number;
    totalFollowUpRuns: number;
    totalViolations: number;
    resolvedViolations: number;
    resolvedPercent: number | null;
    categories: LiveJointCategoryRow[];
    items: LiveJointItemRow[];
    units: LiveJointUnitRow[];
    mismatches: LiveCountedRow[];
  };
};

/** Display labels for joint-inspection categories (sidebar table). */
const JOINT_CATEGORY_DISPLAY: Array<{
  source: string[];
  code: string;
  name: string;
}> = [
  {
    source: ["байгаль орчин", "бо"],
    code: "БО",
    name: "БО",
  },
  {
    source: ["хабэа", "хөдөлмөрийн аюулгүй байдал"],
    code: "ХАБ",
    name: "Хөдөлмөрийн аюулгүй байдал",
  },
  {
    source: ["хүнсний эрүүл ахуй", "хөдөлмөрийн эрүүл ахуй"],
    code: "ХЭА",
    name: "Хөдөлмөрийн эрүүл ахуй",
  },
  {
    source: ["дотоод хяналт шалгалт", "дхш"],
    code: "ДХШ",
    name: "ДХШ",
  },
];

/** Struck-through / retired joint checklist row from the reference sheet. */
const JOINT_EXCLUDED_ITEM_HINTS = [
  "хоол үйлдвэрлэлийн тоног төхөөрөмжийн ажиллагаа хэвийн эсэх",
];

function jointCategoryMeta(category: string | null | undefined) {
  const key = norm(category);
  const matched = JOINT_CATEGORY_DISPLAY.find((row) =>
    row.source.some((source) => key === source || key.includes(source)),
  );
  if (matched) {
    return { key: norm(matched.code), code: matched.code, name: matched.name };
  }
  const label = (category ?? "").trim() || "Бусад";
  return { key: norm(label), code: label, name: label };
}

function isExcludedJointItem(item: string) {
  const value = norm(item);
  return JOINT_EXCLUDED_ITEM_HINTS.some((hint) => value.includes(hint));
}

function jointItemLabel(ctx: FindingContext) {
  return (
    ctx.question?.questionText ||
    ctx.finding.description ||
    ctx.finding.title ||
    "Бусад"
  );
}

function jointCategoryLabel(ctx: FindingContext, masterItems: JointInspectionItem[]) {
  const fromQuestion = ctx.question?.legalReference || ctx.question?.rawText;
  if (fromQuestion) return fromQuestion;
  const itemText = norm(jointItemLabel(ctx));
  const master = masterItems.find((row) => norm(row.item) === itemText);
  return master?.category || "Бусад";
}

function norm(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function includesText(haystack: string | null | undefined, needle: string | null | undefined) {
  const a = norm(haystack);
  const b = norm(needle);
  return Boolean(a && b && a.includes(b));
}

function percent(part: number, total: number) {
  return total > 0 ? part / total : null;
}

function average(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function latestDate(values: string[]) {
  return values.filter(Boolean).sort().at(-1) ?? "";
}

function isResolved(status: InspectionFinding["status"]) {
  return status === "resolved" || status === "closed";
}

function isFollowUpRun(run: InspectionRun) {
  return run.planMetric === "completed";
}

function monthKey(date: string) {
  return date && /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : "unscheduled";
}

function monthLabel(key: string) {
  if (key === "unscheduled") return "Огноогүй";
  return `${key.slice(0, 4)}-${key.slice(5, 7)}`;
}

function scoreForRun(data: InspectionCenterData, runId: string): InspectionScoreSnapshot | null {
  return getRunScore(data, runId);
}

function buildContexts(data: InspectionCenterData) {
  const runs = new Map(data.runs.map((run) => [run.id, run]));
  const answers = new Map(data.answers.map((answer) => [answer.id, answer]));
  const questions = new Map(data.questions.map((question) => [question.id, question]));
  const actionsByFinding = new Map(data.actions.map((action) => [action.findingId, action]));

  return data.findings.flatMap((finding): FindingContext[] => {
    const run = runs.get(finding.runId);
    if (!run) return [];
    const answer = finding.answerId ? answers.get(finding.answerId) ?? null : null;
    const question = answer ? questions.get(answer.templateQuestionId) ?? null : null;
    return [
      {
        finding,
        run,
        answer,
        question,
        action: actionsByFinding.get(finding.id) ?? null,
      },
    ];
  });
}

function countByItem(contexts: FindingContext[], labelFor: (ctx: FindingContext) => string) {
  const map = new Map<string, LiveCountedRow>();
  for (const ctx of contexts) {
    const item = labelFor(ctx).trim() || ctx.finding.title || "Бусад";
    const key = norm(item);
    const existing = map.get(key) ?? {
      key,
      item,
      count: 0,
      resolvedCount: 0,
      resolvedPercent: null,
    };
    existing.count += 1;
    if (isResolved(ctx.finding.status)) existing.resolvedCount += 1;
    existing.resolvedPercent = percent(existing.resolvedCount, existing.count);
    map.set(key, existing);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.item.localeCompare(b.item));
}

function templateMatchesStateRow(template: InspectionTemplate, row: StateInspectionProgressRow) {
  const code = norm(row.checklistNumber).replace(/^№\s*/, "");
  const templateCode = norm(template.code).replace(/^№\s*/, "");
  return (
    templateCode === code ||
    includesText(template.title, row.checklistName) ||
    includesText(row.checklistName, template.title) ||
    includesText(template.code, code) ||
    includesText(code, template.code)
  );
}

function isStateLikeRun(run: InspectionRun) {
  return (
    run.inspectionType === "STATE_INSPECTION" ||
    run.inspectionType === "CHECKLIST" ||
    run.inspectionType === "UNPLANNED_INSPECTION"
  );
}

function stateSourceRows(
  data: InspectionCenterData,
  master: MasterWorkbookData,
): StateInspectionProgressRow[] {
  if (master.stateInspectionRows.length) return master.stateInspectionRows;
  return data.templates.map((template, index) => ({
    id: template.id,
    sequence: index + 1,
    authority: template.category || "",
    checklistNumber: template.code,
    checklistName: template.title,
    inspectionDate: "",
    requiredScoreFormulaOrValue: "",
    failedScore: null,
    riskPercentFormulaOrValue: "",
    implementationFormulaOrValue: "",
    violationCountFormulaOrValue: "",
    executionStatus: "",
    responsibleEmployee: "",
    progressPercent: null,
    dueDate: "",
    sourceSheetName: template.sourceSheetName,
  }));
}

function runsForStateRow(
  data: InspectionCenterData,
  row: StateInspectionProgressRow,
) {
  const templates = data.templates.filter((template) =>
    templateMatchesStateRow(template, row),
  );
  const templateIds = new Set(templates.map((template) => template.id));
  const checklistNo = norm(row.checklistNumber).replace(/^№\s*/, "");

  return data.runs.filter((run) => {
    if (isFollowUpRun(run) || !isStateLikeRun(run)) return false;
    if (run.templateId && templateIds.has(run.templateId)) return true;
    if (run.inspectionType === "STATE_INSPECTION") {
      return (
        includesText(run.title, row.checklistNumber) ||
        includesText(run.title, checklistNo) ||
        includesText(run.title, row.checklistName)
      );
    }
    return (
      includesText(run.title, row.checklistNumber) ||
      includesText(run.title, checklistNo) ||
      includesText(run.title, row.checklistName)
    );
  });
}

function stateRows(
  data: InspectionCenterData,
  master: MasterWorkbookData,
  contexts: FindingContext[],
) {
  const scoreCache = new Map<string, InspectionScoreSnapshot | null>();
  const score = (runId: string) => {
    if (!scoreCache.has(runId)) scoreCache.set(runId, scoreForRun(data, runId));
    return scoreCache.get(runId) ?? null;
  };

  return stateSourceRows(data, master).map((row, index): LiveStateRow => {
    const templates = data.templates.filter((template) =>
      templateMatchesStateRow(template, row),
    );
    const runs = runsForStateRow(data, row);
    const runIds = new Set(runs.map((run) => run.id));
    const findings = contexts.filter((ctx) => runIds.has(ctx.run.id));
    const resolvedCount = findings.filter((ctx) =>
      isResolved(ctx.finding.status),
    ).length;
    const scores = runs.map((run) => score(run.id));
    const completedRuns = runs.filter(
      (run) => run.status === "completed" || run.status === "submitted",
    ).length;

    return {
      id: row.id ?? `state-${index}`,
      authority: row.authority || "Байгууллагагүй",
      checklistNumber: row.checklistNumber,
      inspectionCount: runs.length,
      displayNo: row.sequence || index + 1,
      implementationPercent:
        average(scores.map((item) => item?.compliancePercent)) ??
        row.progressPercent,
      checklistName:
        row.checklistName || templates[0]?.title || row.checklistNumber,
      inspectionDate:
        latestDate(runs.map((run) => run.inspectionDate)) || row.inspectionDate,
      executionStatus:
        runs.length === 0
          ? "Төлөвлөгдөөгүй"
          : completedRuns === runs.length
            ? "Дууссан"
            : completedRuns > 0
              ? "Хэсэгчлэн"
              : "Явагдаж байгаа",
      violationCount: findings.length,
      openCount: findings.length - resolvedCount,
      resolvedCount,
      riskPercent: average(scores.map((item) => item?.riskPercent)),
    };
  });
}

function stateItemLabel(ctx: FindingContext) {
  if (ctx.question?.questionNo && ctx.question.questionText) {
    return `${ctx.question.questionNo}. ${ctx.question.questionText}`;
  }
  return (
    ctx.question?.questionText ||
    ctx.finding.description ||
    ctx.finding.title ||
    "Бусад"
  );
}

function stateItemRows(
  data: InspectionCenterData,
  master: MasterWorkbookData,
  contexts: FindingContext[],
): LiveStateItemRow[] {
  const rows: LiveStateItemRow[] = [];
  const assignedFindingIds = new Set<string>();

  for (const [index, row] of stateSourceRows(data, master).entries()) {
    const runs = runsForStateRow(data, row);
    const runIds = new Set(runs.map((run) => run.id));
    const findings = contexts.filter((ctx) => runIds.has(ctx.run.id));
    for (const ctx of findings) assignedFindingIds.add(ctx.finding.id);

    const byItem = countByItem(findings, stateItemLabel);
    const authority = row.authority || "Байгууллагагүй";
    const checklistName = row.checklistName || row.checklistNumber || "Хуудас";
    const checklistKey = norm(
      `${row.checklistNumber}-${checklistName}-${row.id ?? index}`,
    );

    for (const item of byItem) {
      if (item.count <= 0) continue;
      const sample =
        findings.find((ctx) => norm(stateItemLabel(ctx)) === item.key) ??
        findings[0];
      rows.push({
        key: `state-item-${checklistKey}-${item.key}`,
        authorityKey: norm(authority),
        authority,
        checklistKey,
        checklistNumber: row.checklistNumber,
        checklistName,
        displayNo: row.sequence || index + 1,
        questionNo: sample?.question?.questionNo || "",
        item: item.item,
        violationCount: item.count,
        openCount: item.count - item.resolvedCount,
        resolvedCount: item.resolvedCount,
        resolvedPercent: item.resolvedPercent,
      });
    }
  }

  // Findings on state-like runs that did not match a master checklist row.
  const unmatched = contexts.filter(
    (ctx) =>
      isStateLikeRun(ctx.run) &&
      !isFollowUpRun(ctx.run) &&
      !assignedFindingIds.has(ctx.finding.id),
  );
  if (unmatched.length > 0) {
    const byRun = new Map<string, FindingContext[]>();
    for (const ctx of unmatched) {
      const list = byRun.get(ctx.run.id) ?? [];
      list.push(ctx);
      byRun.set(ctx.run.id, list);
    }
    let extraIndex = 0;
    for (const [runId, findingContexts] of byRun) {
      const run = findingContexts[0]?.run;
      if (!run) continue;
      const authority = run.inspectedByOrg || "Байгууллагагүй";
      const checklistName = run.title || runId.slice(0, 8);
      const checklistKey = `extra-${runId}`;
      const byItem = countByItem(findingContexts, stateItemLabel);
      for (const item of byItem) {
        rows.push({
          key: `state-extra-${checklistKey}-${item.key}`,
          authorityKey: norm(authority),
          authority,
          checklistKey,
          checklistNumber: "",
          checklistName,
          displayNo: 10_000 + extraIndex++,
          questionNo: "",
          item: item.item,
          violationCount: item.count,
          openCount: item.count - item.resolvedCount,
          resolvedCount: item.resolvedCount,
          resolvedPercent: item.resolvedPercent,
        });
      }
    }
  }

  return rows.sort(
    (a, b) =>
      a.displayNo - b.displayNo ||
      a.authority.localeCompare(b.authority, "mn") ||
      a.item.localeCompare(b.item, "mn"),
  );
}

function stateAuthorityRows(items: LiveStateItemRow[]): LiveStateAuthorityRow[] {
  const map = new Map<string, LiveStateAuthorityRow>();
  for (const item of items) {
    const existing = map.get(item.authorityKey) ?? {
      key: item.authorityKey,
      name: item.authority,
      violationCount: 0,
      openCount: 0,
      resolvedCount: 0,
      resolvedPercent: null,
    };
    existing.violationCount += item.violationCount;
    existing.openCount += item.openCount;
    existing.resolvedCount += item.resolvedCount;
    existing.resolvedPercent = percent(
      existing.resolvedCount,
      existing.violationCount,
    );
    map.set(item.authorityKey, existing);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "mn"));
}

function monthlyRows(runs: InspectionRun[], contexts: FindingContext[]) {
  const keys = new Set([...runs.map((run) => monthKey(run.inspectionDate)), ...contexts.map((ctx) => monthKey(ctx.finding.createdAt))]);
  if (keys.size === 0) keys.add(monthKey(new Date().toISOString()));

  return [...keys].sort().map((key): LiveMonthlyRow => {
    const runIds = new Set(runs.filter((run) => monthKey(run.inspectionDate) === key).map((run) => run.id));
    const findings = contexts.filter((ctx) => runIds.has(ctx.run.id) || monthKey(ctx.finding.createdAt) === key);
    const resolvedCount = findings.filter((ctx) => isResolved(ctx.finding.status)).length;
    return {
      monthKey: key,
      monthLabel: monthLabel(key),
      inspectionCount: runIds.size,
      violationCount: findings.length,
      resolvedCount,
      resolvedPercent: percent(resolvedCount, findings.length),
    };
  });
}

function jointCategories(
  masterItems: JointInspectionItem[],
  contexts: FindingContext[],
) {
  const order = JOINT_CATEGORY_DISPLAY.map((row) => norm(row.code));
  const keys = new Map<string, { code: string; name: string }>();

  for (const item of masterItems) {
    if (isExcludedJointItem(item.item)) continue;
    const meta = jointCategoryMeta(item.category);
    keys.set(meta.key, { code: meta.code, name: meta.name });
  }
  for (const ctx of contexts) {
    const meta = jointCategoryMeta(jointCategoryLabel(ctx, masterItems));
    keys.set(meta.key, { code: meta.code, name: meta.name });
  }

  return [...keys.entries()]
    .map(([key, meta]): LiveJointCategoryRow => {
      const findings = contexts.filter((ctx) => {
        const label = jointCategoryMeta(jointCategoryLabel(ctx, masterItems));
        return label.key === key;
      });
      const resolvedCount = findings.filter((ctx) =>
        isResolved(ctx.finding.status),
      ).length;
      return {
        key,
        code: meta.code,
        name: meta.name,
        violationCount: findings.length,
        sharePercent: percent(findings.length, contexts.length),
        resolvedCount,
        resolvedPercent: percent(resolvedCount, findings.length),
      };
    })
    .sort((a, b) => {
      const ai = order.indexOf(a.key);
      const bi = order.indexOf(b.key);
      const aOrder = ai === -1 ? 999 : ai;
      const bOrder = bi === -1 ? 999 : bi;
      return aOrder - bOrder || a.name.localeCompare(b.name, "mn");
    });
}

/** Operational count rows (black text) — not treated as violation indicators. */
const NIGHT_NON_VIOLATION_SECTIONS = new Set(["ажилтан", "техник"]);

function isNightViolationSection(sectionTitle: string) {
  return !NIGHT_NON_VIOLATION_SECTIONS.has(norm(sectionTitle));
}

function nightQuestionLabel(item: NightInspectionItem) {
  return [item.sectionTitle, item.item, item.note].filter(Boolean).join(" - ");
}

function nightAreaKey(area: string) {
  return norm(area) || "бусад";
}

function matchesNightMasterItem(
  ctx: FindingContext,
  item: NightInspectionItem,
) {
  const question = norm(
    ctx.question?.questionText || ctx.finding.description || ctx.finding.title,
  );
  const composed = norm(nightQuestionLabel(item));
  const itemText = norm(item.item);
  const sectionText = norm(item.sectionTitle);
  const areaHint = norm(
    ctx.question?.rawText || ctx.question?.legalReference || "",
  );
  const areaOk =
    !areaHint ||
    areaHint.includes(norm(item.area)) ||
    norm(item.area).includes(areaHint.split(" / ")[0] ?? "");

  if (!areaOk) return false;
  if (question === composed || question === itemText) return true;
  return Boolean(
    sectionText &&
      itemText &&
      question.includes(sectionText) &&
      question.includes(itemText),
  );
}

function nightItemRows(
  masterItems: NightInspectionItem[],
  contexts: FindingContext[],
): LiveNightItemRow[] {
  const activeMaster = masterItems
    .slice()
    .sort(
      (a, b) =>
        (a.sequence || 0) - (b.sequence || 0) ||
        a.area.localeCompare(b.area, "mn") ||
        a.item.localeCompare(b.item, "mn"),
    );

  const rows = activeMaster.map((item, index): LiveNightItemRow => {
    const findings = contexts.filter((ctx) =>
      matchesNightMasterItem(ctx, item),
    );
    const resolvedCount = findings.filter((ctx) =>
      isResolved(ctx.finding.status),
    ).length;
    return {
      key: item.id ?? `night-item-${item.sequence || index + 1}`,
      sequence: item.sequence || index + 1,
      areaKey: nightAreaKey(item.area),
      areaName: item.area || "Бусад",
      sectionNo: item.sectionNo || "",
      sectionTitle: item.sectionTitle || "Бусад",
      item: item.item || item.sectionTitle || "Бусад",
      isViolationIndicator: isNightViolationSection(item.sectionTitle),
      violationCount: findings.length,
      openCount: findings.length - resolvedCount,
      resolvedCount,
      resolvedPercent: percent(resolvedCount, findings.length),
    };
  });

  const matched = new Set(
    contexts
      .filter((ctx) =>
        activeMaster.some((item) => matchesNightMasterItem(ctx, item)),
      )
      .map((ctx) => ctx.finding.id),
  );
  const unmatched = contexts.filter((ctx) => !matched.has(ctx.finding.id));
  if (unmatched.length > 0) {
    const byItem = countByItem(
      unmatched,
      (ctx) =>
        ctx.question?.questionText ||
        ctx.finding.description ||
        ctx.finding.title,
    );
    for (const row of byItem) {
      const sample =
        unmatched.find(
          (ctx) =>
            norm(
              ctx.question?.questionText ||
                ctx.finding.description ||
                ctx.finding.title,
            ) === row.key,
        ) ?? unmatched[0];
      const areaName =
        sample.question?.rawText ||
        sample.question?.legalReference?.split(" / ")[0] ||
        "Бусад";
      rows.push({
        key: `night-extra-${row.key}`,
        sequence: 10_000 + rows.length,
        areaKey: nightAreaKey(areaName),
        areaName,
        sectionNo: "",
        sectionTitle: "Бусад",
        item: row.item,
        isViolationIndicator: true,
        violationCount: row.count,
        openCount: row.count - row.resolvedCount,
        resolvedCount: row.resolvedCount,
        resolvedPercent: row.resolvedPercent,
      });
    }
  }

  return rows;
}

function nightAreaRows(items: LiveNightItemRow[]): LiveNightAreaRow[] {
  const map = new Map<string, LiveNightAreaRow>();
  for (const item of items.filter((row) => row.isViolationIndicator)) {
    const existing = map.get(item.areaKey) ?? {
      key: item.areaKey,
      name: item.areaName,
      violationCount: 0,
      openCount: 0,
      resolvedCount: 0,
      resolvedPercent: null,
    };
    existing.violationCount += item.violationCount;
    existing.openCount += item.openCount;
    existing.resolvedCount += item.resolvedCount;
    existing.resolvedPercent = percent(
      existing.resolvedCount,
      existing.violationCount,
    );
    map.set(item.areaKey, existing);
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "mn"));
}

function jointItemRows(
  masterItems: JointInspectionItem[],
  contexts: FindingContext[],
): LiveJointItemRow[] {
  const activeMaster = masterItems
    .filter((item) => !isExcludedJointItem(item.item))
    .slice()
    .sort(
      (a, b) =>
        (a.sequence || 0) - (b.sequence || 0) ||
        a.item.localeCompare(b.item, "mn"),
    );

  const masterKeys = new Set(activeMaster.map((item) => norm(item.item)));
  const rows = activeMaster.map((item, index): LiveJointItemRow => {
    const category = jointCategoryMeta(item.category);
    const findings = contexts.filter(
      (ctx) => norm(jointItemLabel(ctx)) === norm(item.item),
    );
    const resolvedCount = findings.filter((ctx) =>
      isResolved(ctx.finding.status),
    ).length;
    return {
      key: item.id ?? `joint-item-${item.sequence || index + 1}`,
      sequence: item.sequence || index + 1,
      categoryKey: category.key,
      categoryName: category.name,
      item: item.item,
      violationCount: findings.length,
      openCount: findings.length - resolvedCount,
      resolvedCount,
      resolvedPercent: percent(resolvedCount, findings.length),
    };
  });

  // Keep findings that no longer match a master row visible.
  const unmatched = contexts.filter(
    (ctx) => !masterKeys.has(norm(jointItemLabel(ctx))),
  );
  if (unmatched.length > 0) {
    const byItem = countByItem(unmatched, jointItemLabel);
    for (const row of byItem) {
      const sample =
        unmatched.find((ctx) => norm(jointItemLabel(ctx)) === row.key) ??
        unmatched[0];
      const category = jointCategoryMeta(
        jointCategoryLabel(sample, masterItems),
      );
      rows.push({
        key: `joint-extra-${row.key}`,
        sequence: 10_000 + rows.length,
        categoryKey: category.key,
        categoryName: category.name,
        item: row.item,
        violationCount: row.count,
        openCount: row.count - row.resolvedCount,
        resolvedCount: row.resolvedCount,
        resolvedPercent: row.resolvedPercent,
      });
    }
  }

  return rows;
}

const OVERVIEW_FINDING_TYPES = [
  "STATE_INSPECTION",
  "CHECKLIST",
  "NIGHT_INSPECTION",
  "JOINT_INSPECTION",
  "DOCUMENT_INSPECTION",
  "UNPLANNED_INSPECTION",
] as const;

type OverviewFindingType = (typeof OVERVIEW_FINDING_TYPES)[number];

function isOverviewFindingType(
  type: InspectionRun["inspectionType"],
): type is OverviewFindingType {
  return (OVERVIEW_FINDING_TYPES as readonly string[]).includes(type);
}

function emptyOverviewByType(): Record<
  OverviewFindingType,
  { registered: number; resolved: number }
> {
  return {
    STATE_INSPECTION: { registered: 0, resolved: 0 },
    CHECKLIST: { registered: 0, resolved: 0 },
    NIGHT_INSPECTION: { registered: 0, resolved: 0 },
    JOINT_INSPECTION: { registered: 0, resolved: 0 },
    DOCUMENT_INSPECTION: { registered: 0, resolved: 0 },
    UNPLANNED_INSPECTION: { registered: 0, resolved: 0 },
  };
}

export function buildLiveSidebarDashboard(
  data: InspectionCenterData,
  master: MasterWorkbookData,
): LiveSidebarDashboard {
  const contexts = buildContexts(data);
  const activeContexts = contexts.filter((ctx) => !isFollowUpRun(ctx.run));
  const overviewContexts = activeContexts.filter((ctx) =>
    isOverviewFindingType(ctx.run.inspectionType),
  );
  const byType = emptyOverviewByType();
  for (const ctx of overviewContexts) {
    const bucket = byType[ctx.run.inspectionType];
    bucket.registered += 1;
    // Same rule as Засах арга хэмжээ → Арилсан table (resolved/closed findings).
    if (isResolved(ctx.finding.status)) bucket.resolved += 1;
  }
  const overviewResolved = overviewContexts.filter((ctx) =>
    isResolved(ctx.finding.status),
  ).length;
  const stateFollowUpRuns = data.runs.filter(
    (run) =>
      isFollowUpRun(run) &&
      run.inspectionType !== "NIGHT_INSPECTION" &&
      run.inspectionType !== "JOINT_INSPECTION",
  );
  const nightRuns = data.runs.filter(
    (run) => run.inspectionType === "NIGHT_INSPECTION" && !isFollowUpRun(run),
  );
  const nightFollowUpRuns = data.runs.filter(
    (run) => run.inspectionType === "NIGHT_INSPECTION" && isFollowUpRun(run),
  );
  const jointRuns = data.runs.filter(
    (run) => run.inspectionType === "JOINT_INSPECTION" && !isFollowUpRun(run),
  );
  const jointFollowUpRuns = data.runs.filter(
    (run) => run.inspectionType === "JOINT_INSPECTION" && isFollowUpRun(run),
  );
  const nightRunIds = new Set(nightRuns.map((run) => run.id));
  const jointRunIds = new Set(jointRuns.map((run) => run.id));
  const nightContexts = activeContexts.filter((ctx) => nightRunIds.has(ctx.run.id));
  const jointContexts = activeContexts.filter((ctx) => jointRunIds.has(ctx.run.id));
  const stateContexts = activeContexts.filter((ctx) => isStateLikeRun(ctx.run));
  const state = stateRows(data, master, stateContexts);
  const stateItems = stateItemRows(data, master, stateContexts);
  const nightItems = nightItemRows(master.nightInspectionItems, nightContexts);
  const nightViolationItems = nightItems.filter((row) => row.isViolationIndicator);
  const nightViolationMaster = master.nightInspectionItems.filter((item) =>
    isNightViolationSection(item.sectionTitle),
  );
  const nightViolationContexts = nightContexts.filter((ctx) =>
    nightViolationMaster.some((item) => matchesNightMasterItem(ctx, item)),
  );
  const nightViolationTotal = nightViolationItems.reduce(
    (sum, row) => sum + row.violationCount,
    0,
  );
  const nightResolvedTotal = nightViolationItems.reduce(
    (sum, row) => sum + row.resolvedCount,
    0,
  );
  const jointResolved = jointContexts.filter((ctx) => isResolved(ctx.finding.status)).length;

  return {
    overview: {
      totalViolations: overviewContexts.length,
      resolvedViolations: overviewResolved,
      byType,
    },
    state: {
      totalChecklists: state.length,
      totalRuns: state.reduce((sum, row) => sum + row.inspectionCount, 0),
      totalFollowUpRuns: stateFollowUpRuns.length,
      totalViolations: stateItems.reduce(
        (sum, row) => sum + row.violationCount,
        0,
      ),
      resolvedViolations: stateItems.reduce(
        (sum, row) => sum + row.resolvedCount,
        0,
      ),
      rows: state,
      authorities: stateAuthorityRows(stateItems),
      items: stateItems,
    },
    night: {
      totalRuns: nightRuns.length,
      totalFollowUpRuns: nightFollowUpRuns.length,
      totalViolations: nightViolationTotal,
      resolvedViolations: nightResolvedTotal,
      resolvedPercent: percent(nightResolvedTotal, nightViolationTotal),
      monthly: monthlyRows(nightRuns, nightViolationContexts),
      areas: nightAreaRows(nightItems),
      items: nightItems,
      mismatches: countByItem(
        nightViolationContexts,
        (ctx) => ctx.question?.questionText ?? ctx.finding.description,
      ),
    },
    joint: {
      totalRuns: jointRuns.length,
      totalFollowUpRuns: jointFollowUpRuns.length,
      totalViolations: jointContexts.length,
      resolvedViolations: jointResolved,
      resolvedPercent: percent(jointResolved, jointContexts.length),
      categories: jointCategories(master.jointInspectionItems, jointContexts),
      items: jointItemRows(master.jointInspectionItems, jointContexts),
      units: countByItem(jointContexts, (ctx) => ctx.finding.targetOrgUnitId || ctx.run.inspectedByOrg || "Нэгж сонгоогүй").map((row) => ({
        key: row.key,
        unit: row.item,
        totalCount: row.count,
        resolvedCount: row.resolvedCount,
        resolvedPercent: row.resolvedPercent,
      })),
      mismatches: countByItem(jointContexts, (ctx) => ctx.question?.questionText ?? ctx.finding.description),
    },
  };
}
