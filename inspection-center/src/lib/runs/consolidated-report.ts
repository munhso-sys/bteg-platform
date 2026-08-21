import type {
  InspectionAnswer,
  InspectionTemplateQuestion,
  JointUnitScope,
} from "@/lib/types";

export type HazardClass = "A" | "B" | "C" | "D";

export type NonConformityItem = {
  id: string;
  category: string;
  hazardClass: HazardClass;
  department: string;
  unitKey: string;
  disagreement: string;
  questionNo: string;
  actionRequired: string;
  responsiblePerson: string;
  targetDate: string;
  photoUrl: string | null;
  photoName: string | null;
  failedScore: number;
};

export type ConsolidatedViolationRow = {
  answerId: string;
  questionNo: string;
  questionText: string;
  category: string;
  approvedScore: number;
  totalFailedScore: number;
  unitCount: number;
  units: Array<{
    unitKey: string;
    label: string;
    failedScore: number;
    comment: string;
    photoUrl: string | null;
    photoName: string | null;
  }>;
  comments: string[];
  photos: Array<{
    unitLabel: string;
    photoUrl: string;
    photoName: string | null;
  }>;
};

export type ConsolidatedReport = {
  savedUnitCount: number;
  totalUnitCount: number;
  violationQuestionCount: number;
  totalFailedScore: number;
  inspectedUnits: string[];
  byUnit: Array<{
    key: string;
    label: string;
    violationCount: number;
    failedScore: number;
    approvedScoreTotal: number;
    /** Зөрчлийн оноо / нийт батлагдсан оноо × 100 */
    scoreSharePercent: number;
  }>;
  byQuestion: ConsolidatedViolationRow[];
  byCategory: Array<{
    category: string;
    items: NonConformityItem[];
  }>;
  nonConformities: NonConformityItem[];
  aiConclusion: string;
};

function isViolationScore(receivedScore: number, isApplicable: boolean) {
  return isApplicable && Math.max(0, receivedScore || 0) > 0;
}

function hazardClassFromScore(
  failedScore: number,
  approvedScore: number,
): HazardClass {
  if (approvedScore > 0 && failedScore >= approvedScore) {
    if (failedScore >= approvedScore * 1.5) return "A";
    return "B";
  }
  if (failedScore >= 2) return "C";
  return "D";
}

function normalizeCategory(raw: string) {
  const text = raw.trim();
  if (!text) return "Бусад";
  const key = text.toLowerCase();
  if (
    key.includes("хаб") ||
    key.includes("аюулгүй") ||
    key.includes("safety")
  ) {
    return "Хөдөлмөрийн Аюулгүй Байдал";
  }
  if (
    key.includes("байгаль") ||
    key.includes("орчин") ||
    key.includes("environment") ||
    /(^|[^\p{L}])бо([^\p{L}]|$)/u.test(key)
  ) {
    return "Байгаль Орчин";
  }
  if (
    key.includes("хүнс") ||
    key.includes("эрүүл") ||
    key.includes("hygiene") ||
    key.includes("хэа")
  ) {
    return "Хөдөлмөрийн эрүүл ахуй";
  }
  if (key.includes("дотоод") || key.includes("дхш") || key.includes("internal")) {
    return "Дотоод хяналт шалгалт";
  }
  return text;
}

function parseActionFromComment(comment: string) {
  const text = comment.trim();
  if (!text) {
    return {
      actionRequired: "Зөрчлийг арилгах арга хэмжээ төлөвлөх",
      responsiblePerson: "",
      targetDate: "",
    };
  }
  const actionMatch = text.match(
    /(?:арга\s*хэмжээ|action)\s*[:：]\s*([^|;]+)/i,
  );
  const personMatch = text.match(
    /(?:хариуцагч|responsible)\s*[:：]\s*([^|;]+)/i,
  );
  const dateMatch = text.match(
    /(?:хугацаа|date|дуусах)\s*[:：]\s*(\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{4}-\d{2}-\d{2})/i,
  );
  return {
    // Free-text comment is treated as the required action unless structured.
    actionRequired: actionMatch?.[1]?.trim() || text,
    responsiblePerson: personMatch?.[1]?.trim() || "",
    targetDate: dateMatch?.[1]?.trim().replace(/\./g, "-") || "",
  };
}

export function buildConsolidatedViolationReport(input: {
  scopes: JointUnitScope[];
  rows: Array<{
    answer: InspectionAnswer;
    question: InspectionTemplateQuestion | undefined;
  }>;
  allUnitLabels?: Array<{ key: string; label: string }>;
}): ConsolidatedReport {
  const savedScopes = input.scopes.filter((scope) => scope.saved);
  const byQuestion: ConsolidatedViolationRow[] = [];
  const nonConformities: NonConformityItem[] = [];

  for (const { answer, question } of input.rows) {
    const units: ConsolidatedViolationRow["units"] = [];
    const category = normalizeCategory(
      question?.legalReference || question?.rawText || "",
    );
    const questionText = question?.questionText || answer.comment || "Асуулт";
    const questionNo = question?.questionNo ?? "—";

    for (const scope of savedScopes) {
      const state = scope.answers[answer.id];
      if (!state) continue;
      if (!isViolationScore(state.receivedScore, state.isApplicable)) continue;
      units.push({
        unitKey: scope.unitKey,
        label: scope.label,
        failedScore: state.receivedScore,
        comment: state.comment?.trim() || "",
        photoUrl: state.photoUrl ?? null,
        photoName: state.photoName ?? null,
      });

      const parsed = parseActionFromComment(state.comment?.trim() || "");
      nonConformities.push({
        id: `${scope.unitKey}:${answer.id}`,
        category,
        hazardClass: hazardClassFromScore(
          state.receivedScore,
          answer.approvedScore,
        ),
        department: scope.label,
        unitKey: scope.unitKey,
        disagreement: questionText,
        questionNo,
        actionRequired: parsed.actionRequired,
        responsiblePerson: parsed.responsiblePerson,
        targetDate: parsed.targetDate,
        photoUrl: state.photoUrl ?? null,
        photoName: state.photoName ?? null,
        failedScore: state.receivedScore,
      });
    }

    if (units.length === 0) continue;
    const totalFailedScore = units.reduce(
      (sum, unit) => sum + unit.failedScore,
      0,
    );
    byQuestion.push({
      answerId: answer.id,
      questionNo,
      questionText,
      category,
      approvedScore: answer.approvedScore,
      totalFailedScore,
      unitCount: units.length,
      units,
      comments: units.map((unit) => unit.comment).filter(Boolean),
      photos: units
        .filter((unit) => Boolean(unit.photoUrl))
        .map((unit) => ({
          unitLabel: unit.label,
          photoUrl: unit.photoUrl!,
          photoName: unit.photoName,
        })),
    });
  }

  byQuestion.sort(
    (a, b) =>
      b.totalFailedScore - a.totalFailedScore ||
      b.unitCount - a.unitCount ||
      a.questionNo.localeCompare(b.questionNo, undefined, { numeric: true }),
  );

  nonConformities.sort((a, b) => {
    const cat = a.category.localeCompare(b.category, "mn");
    if (cat !== 0) return cat;
    const dept = a.department.localeCompare(b.department, "mn");
    if (dept !== 0) return dept;
    return a.questionNo.localeCompare(b.questionNo, undefined, {
      numeric: true,
    });
  });

  const unitMap = new Map<
    string,
    {
      key: string;
      label: string;
      violationCount: number;
      failedScore: number;
      approvedScoreTotal: number;
      scoreSharePercent: number;
    }
  >();
  for (const scope of savedScopes) {
    let approvedScoreTotal = 0;
    for (const { answer } of input.rows) {
      const state = scope.answers[answer.id];
      if (!state || !state.isApplicable) continue;
      approvedScoreTotal += Math.max(0, answer.approvedScore || 0);
    }
    unitMap.set(scope.unitKey, {
      key: scope.unitKey,
      label: scope.label,
      violationCount: 0,
      failedScore: 0,
      approvedScoreTotal,
      scoreSharePercent: 0,
    });
  }
  for (const item of nonConformities) {
    const current = unitMap.get(item.unitKey);
    if (!current) continue;
    current.violationCount += 1;
    current.failedScore += item.failedScore;
  }
  for (const unit of unitMap.values()) {
    unit.scoreSharePercent =
      unit.approvedScoreTotal > 0
        ? Math.round((unit.failedScore / unit.approvedScoreTotal) * 1000) / 10
        : unit.failedScore > 0
          ? 100
          : 0;
  }
  const byUnit = [...unitMap.values()].sort(
    (a, b) =>
      b.scoreSharePercent - a.scoreSharePercent ||
      b.failedScore - a.failedScore ||
      b.violationCount - a.violationCount,
  );

  const categoryMap = new Map<string, NonConformityItem[]>();
  for (const item of nonConformities) {
    const list = categoryMap.get(item.category) ?? [];
    list.push(item);
    categoryMap.set(item.category, list);
  }
  const byCategory = [...categoryMap.entries()].map(([category, items]) => ({
    category,
    items,
  }));

  const totalFailedScore = nonConformities.reduce(
    (sum, item) => sum + item.failedScore,
    0,
  );

  return {
    savedUnitCount: savedScopes.length,
    totalUnitCount: input.allUnitLabels?.length ?? savedScopes.length,
    violationQuestionCount: byQuestion.length,
    totalFailedScore,
    inspectedUnits: savedScopes.map((scope) => scope.label),
    byUnit,
    byQuestion,
    byCategory,
    nonConformities,
    aiConclusion: buildAiConclusion({
      savedUnitCount: savedScopes.length,
      totalUnitCount: input.allUnitLabels?.length ?? savedScopes.length,
      byUnit,
      byQuestion,
      totalFailedScore,
    }),
  };
}

function buildAiConclusion(input: {
  savedUnitCount: number;
  totalUnitCount: number;
  byUnit: ConsolidatedReport["byUnit"];
  byQuestion: ConsolidatedViolationRow[];
  totalFailedScore: number;
}): string {
  if (input.savedUnitCount === 0) {
    return "Хадгалсан хэсэг байхгүй тул нэгтгэсэн дүгнэлт гаргах боломжгүй. Хэсэг бүрийг бөглөж хадгалсны дараа тайлан шинэчлэгдэнэ.";
  }

  if (input.byQuestion.length === 0) {
    return [
      `${input.savedUnitCount}/${input.totalUnitCount} хэсгийн үр дүнг нэгтгэн үзэхэд зөрчилтэй асуулт бүртгэгдээгүй.`,
      "Одоогоор нийцлийн түвшин өндөр харагдаж байгаа ч бүх хэсгийг бүрэн хадгалсны дараа эцсийн дүгнэлт баталгаажна.",
      "Зөвлөмж: хадгалаагүй хэсгүүдийг дуусгаж, дараагийн ХШ-д давтан хяналт хийх хуваарь гаргана.",
    ].join(" ");
  }

  const topUnits = input.byUnit
    .filter((unit) => unit.violationCount > 0)
    .slice(0, 3)
    .map(
      (unit) =>
        `${unit.label} (${unit.violationCount} зөрчил, ${unit.failedScore} оноо)`,
    );
  const topQuestions = input.byQuestion
    .slice(0, 3)
    .map(
      (row) =>
        `№${row.questionNo} — ${row.unitCount} хэсэгт давтагдсан (нийт ${row.totalFailedScore})`,
    );
  const repeated = input.byQuestion.filter((row) => row.unitCount >= 2);
  const coverage =
    input.totalUnitCount > 0
      ? Math.round((input.savedUnitCount / input.totalUnitCount) * 100)
      : 100;

  const riskLevel =
    input.totalFailedScore >= 20 || repeated.length >= 3
      ? "их"
      : input.totalFailedScore >= 8 || repeated.length >= 1
        ? "дунд"
        : "бага";

  const lines = [
    `Товч дүгнэлт: ${input.savedUnitCount} хэсгийн (${coverage}% хамрах хүрээ) нэгтгэсэн үр дүнгээр ${input.byQuestion.length} зөрчилтэй асуулт, нийт ${input.totalFailedScore} зөрчлийн оноо бүртгэгдсэн. Ерөнхий эрсдэлийн түвшин: ${riskLevel}.`,
  ];

  if (topUnits.length) {
    lines.push(`Хамгийн их зөрчилтэй хэсгүүд: ${topUnits.join("; ")}.`);
  }
  if (topQuestions.length) {
    lines.push(
      `Давтамж өндөртэй зөрчилтэй үзүүлэлтүүд: ${topQuestions.join("; ")}.`,
    );
  }
  if (repeated.length) {
    lines.push(
      `${repeated.length} асуулт олон хэсэгт давтагдаж байгаа нь системийн шинжтэй дутагдал байж болзошгүйг илтгэж байна.`,
    );
  }

  lines.push(
    riskLevel === "их"
      ? "Зөвлөмж: эрсдэл ихтэй хэсгүүдэд шуурхай засах арга хэмжээ төлөвлөж, 7–14 хоногийн дотор гүйцэтгэлийн ХШ хийнэ. Давтагдсан зөрчилд хариуцагч, хугацаа, нотлох баримт заавал тогтооно."
      : riskLevel === "дунд"
        ? "Зөвлөмж: давтагдсан зөрчилд нэгдсэн залруулга хийж, хариуцсан нэгжүүдийг зохион байгуулалттайгаар хянана. Дараагийн тайлант хугацаанд сайжруулалтын үр дүнг баталгаажуулна."
        : "Зөвлөмж: одоогийн зөрчлийг төлөвлөгөөт хугацаанд арилгаж, холбогдох нотлох баримтыг бүрдүүлнэ. Урьдчилан сэргийлэх сургалт, дотоод хяналтыг үргэлжлүүлнэ.",
  );

  if (input.savedUnitCount < input.totalUnitCount) {
    lines.push(
      `Анхааруулга: ${input.totalUnitCount - input.savedUnitCount} хэсэг хадгалаагүй тул тайлан бүрэн бус байж болно.`,
    );
  }

  return lines.join(" ");
}
