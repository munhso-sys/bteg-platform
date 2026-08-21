import type { PlatformReport, ReportRow } from "@/lib/reports/types";

export type FormalReportKpi = {
  label: string;
  value: string;
  interpretation: string;
};

export type RootCauseSignal = {
  title: string;
  evidence: string;
  method: string;
  confidence: "indicator";
};

export type FormalFinding = {
  id: string;
  title: string;
  system: string;
  unit: string;
  severity: string;
  status: string;
  owner: string;
  date: string;
};

export type FormalReport = {
  documentId: string;
  title: string;
  subtitle: string;
  generatedAt: string;
  periodLabel: string;
  executiveSummary: string[];
  kpis: FormalReportKpi[];
  methodology: string[];
  rootCauseSignals: RootCauseSignal[];
  priorityFindings: FormalFinding[];
  recommendations: string[];
  limitations: string[];
  sourceSummary: Array<{ system: string; count: number; high: number }>;
};

function isHigh(row: ReportRow) {
  return ["high", "critical", "өндөр", "ноцтой"].includes(
    row.value.trim().toLocaleLowerCase("mn"),
  );
}

function isOverdue(row: ReportRow) {
  return ["overdue", "хугацаа хэтэрсэн"].includes(
    row.status.trim().toLocaleLowerCase("mn"),
  );
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = key(row).trim() || "Тодорхойгүй";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export function buildFormalReport(data: PlatformReport): FormalReport {
  const generated = new Date(data.generatedAt);
  const highRows = data.rows.filter(isHigh);
  const overdueRows = data.rows.filter(isOverdue);
  const priorityRows = data.rows
    .slice()
    .sort(
      (a, b) =>
        Number(isHigh(b)) - Number(isHigh(a)) ||
        Number(isOverdue(b)) - Number(isOverdue(a)) ||
        b.date.localeCompare(a.date),
    )
    .slice(0, 15);

  const topHighUnit = countBy(highRows, (row) => row.unit)[0];
  const topOverdueUnit = countBy(overdueRows, (row) => row.unit)[0];
  const topHighSystem = countBy(highRows, (row) => row.system)[0];
  const rootCauseSignals: RootCauseSignal[] = [];

  if (topHighUnit) {
    rootCauseSignals.push({
      title: "Өндөр эрсдэлийн нэгжийн төвлөрөл",
      evidence: `${topHighUnit[0]} нэгжид өндөр/ноцтой ${topHighUnit[1]} дохио төвлөрсөн.`,
      method: "Өндөр/ноцтой ангилалтай бүртгэлийг нэгжээр бүлэглэж, давтамжаар эрэмбэлсэн.",
      confidence: "indicator",
    });
  }
  if (topOverdueUnit) {
    rootCauseSignals.push({
      title: "Хугацаа хэтэрсэн арга хэмжээний төвлөрөл",
      evidence: `${topOverdueUnit[0]} нэгжид хугацаа хэтэрсэн ${topOverdueUnit[1]} бүртгэл байна.`,
      method: "Overdue төлөвтэй бүртгэлийг нэгжээр бүлэглэж, хамгийн их давтамжийг сонгосон.",
      confidence: "indicator",
    });
  }
  if (topHighSystem) {
    rootCauseSignals.push({
      title: "Эх системийн төвлөрөл",
      evidence: `${topHighSystem[0]} системээс өндөр/ноцтой ${topHighSystem[1]} дохио бүртгэгдсэн.`,
      method: "Өндөр/ноцтой бүртгэлийг эх системээр бүлэглэсэн.",
      confidence: "indicator",
    });
  }

  const recommendations: string[] = [];
  if (highRows.length) {
    recommendations.push(
      `Өндөр/ноцтой ${highRows.length} бүртгэлийг эзэн, нотолгоо, хаах шалгуураар нэн тэргүүнд баталгаажуулж шийдвэрлэх.`,
    );
  }
  if (overdueRows.length) {
    recommendations.push(
      `Хугацаа хэтэрсэн ${overdueRows.length} ажлын шалтгаан, хамаарал, шинэ хугацаа болон хариуцагчийг удирдлагын түвшинд баталгаажуулах.`,
    );
  }
  if (rootCauseSignals.length) {
    recommendations.push(
      "Суурь шалтгааны дохио бүрийг баримт, ярилцлага, процессын ажиглалтаар баталгаажуулсны дараа corrective/preventive action төлөвлөгөөнд оруулах.",
    );
  }
  if (!recommendations.length) {
    recommendations.push(
      "Одоогийн snapshot-д нэн тэргүүний дохио бага байна. Өгөгдлийн бүрэн байдлыг хянаж, хэвийн мониторингийг үргэлжлүүлэх.",
    );
  }

  return {
    documentId: `INSPECT-REPORT-${generated.toISOString().slice(0, 10)}`,
    title: "ДХШХ-ИЙН ҮЙЛ АЖИЛЛАГААНЫ НЭГДСЭН ТАЙЛАН",
    subtitle: "Удирдлагын шийдвэрт зориулсан KPI, эрсдэл, суурь шалтгааны дохио ба арга хэмжээ",
    generatedAt: data.generatedAt,
    periodLabel: `Мэдээллийн snapshot: ${generated.toLocaleString("mn-MN")}`,
    executiveSummary: data.conclusions.slice(0, 6),
    kpis: data.kpis.slice(0, 12).map((item) => ({
      label: item.label,
      value: item.value,
      interpretation: item.hint,
    })),
    methodology: [
      "Хамрах хүрээ: платформд холбогдсон хяналт шалгалт, журмын биелэлт, судалгаа хөгжүүлэлт, эрсдэл, ажилтны дуу хоолой болон хандалтын snapshot.",
      "Арга: эх системийн дохиог нэгтгэх, өндөр/ноцтой ангилал болон хугацаа хэтрэлтийг ялгах, нэгж ба системээр давтамжийн төвлөрөл тооцох.",
      "Суурь шалтгаан: тайланд зөвхөн өгөгдлийн төвлөрлөөс үүссэн indicator харуулна; баталгаажсан root cause гэж үзэхгүй. Баримтын шалгалт, ярилцлага, ажиглалтаар баталгаажуулна.",
      "Шийдвэрийн эрэмбэ: severity, overdue төлөв, давтамж, хариуцагч болон өгөгдлийн бүрэн байдлыг хамтад нь үнэлнэ.",
    ],
    rootCauseSignals,
    priorityFindings: priorityRows.map((row) => ({
      id: row.id,
      title: row.title,
      system: row.system,
      unit: row.unit,
      severity: row.value,
      status: row.status,
      owner: row.owner,
      date: row.date,
    })),
    recommendations,
    limitations: [
      "Тайлан нь үүсгэсэн мөчийн snapshot бөгөөд эх системийн дараагийн өөрчлөлтийг автоматаар тусгахгүй.",
      "Текстэн тайлбар, эзэн, нэгж эсвэл төлөв дутуу бол бүлэглэл болон суурь шалтгааны дохионы нарийвчлал буурна.",
      "Source error тэмдэглэгдсэн системийн мэдээллийг бүрэн гэж үзэхгүй.",
      ...Object.entries(data.sourceErrors).map(([source, error]) => `${source}: ${error}`),
    ],
    sourceSummary: data.bySystem,
  };
}

