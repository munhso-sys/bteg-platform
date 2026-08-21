import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderFormalReportDocx } from "../src/lib/reports/export-docx.ts";
import { renderFormalReportPdf } from "../src/lib/reports/export-pdf.ts";

const outputDir = resolve("tmp/report-export-qa");
await mkdir(outputDir, { recursive: true });

const report = {
  documentId: "INSPECT-REPORT-QA-2026-08-17",
  title: "ДХШХ-ИЙН ҮЙЛ АЖИЛЛАГААНЫ НЭГДСЭН ТАЙЛАН",
  subtitle: "Удирдлагын шийдвэрт зориулсан KPI, эрсдэл, суурь шалтгааны дохио ба арга хэмжээ",
  generatedAt: "2026-08-17T09:00:00.000Z",
  periodLabel: "Мэдээллийн snapshot: 2026.08.17 17:00",
  executiveSummary: [
    "Нийт 128 дохионоос өндөр болон ноцтой ангилалтай 18 бүртгэл илэрсэн.",
    "Хугацаа хэтэрсэн 9 арга хэмжээг эзэн, нотолгоо, хаах шалгуураар баталгаажуулах шаардлагатай.",
  ],
  kpis: [
    { label: "Нийт дохио", value: "128", interpretation: "Холбогдсон системүүдийн нэгтгэсэн snapshot" },
    { label: "Өндөр/ноцтой", value: "18", interpretation: "Удирдлагын нэн тэргүүний анхаарал шаардсан" },
    { label: "Хугацаа хэтэрсэн", value: "9", interpretation: "Төлөвлөсөн хугацаандаа хаагдаагүй арга хэмжээ" },
  ],
  methodology: [
    "Эх системийн дохиог нэгтгэж, severity болон хугацаа хэтрэлтийн төлвөөр ангилсан.",
    "Нэгж ба эх системээр давтамжийн төвлөрөл тооцсон; үр дүнг баталгаажсан root cause гэж үзээгүй.",
  ],
  rootCauseSignals: [
    {
      title: "Өндөр эрсдэлийн нэгжийн төвлөрөл",
      evidence: "Үйлдвэрлэлийн хэлтэст өндөр/ноцтой 8 дохио төвлөрсөн.",
      method: "Өндөр/ноцтой бүртгэлийг нэгжээр бүлэглэж давтамжаар эрэмбэлсэн.",
      confidence: "indicator",
    },
  ],
  priorityFindings: Array.from({ length: 12 }, (_, index) => ({
    id: `QA-${index + 1}`,
    title: `Хяналтын нотолгоо дутуу бүртгэл ${index + 1}`,
    system: index % 2 ? "Журмын биелэлт" : "Хяналт шалгалт",
    unit: index % 3 ? "Үйлдвэрлэлийн хэлтэс" : "Дотоод хяналтын хэлтэс",
    severity: index < 4 ? "Ноцтой" : "Өндөр",
    status: index % 2 ? "Хугацаа хэтэрсэн" : "Нээлттэй",
    owner: "Хариуцсан ажилтан",
    date: `2026-08-${String(index + 1).padStart(2, "0")}`,
  })),
  recommendations: [
    "Өндөр/ноцтой бүртгэлийг эзэн, нотолгоо, хаах шалгуураар нэн тэргүүнд баталгаажуулах.",
    "Төвлөрлийн дохиог баримт, ярилцлага, процессын ажиглалтаар баталгаажуулах.",
  ],
  limitations: [
    "Тайлан нь үүсгэсэн мөчийн snapshot бөгөөд эх системийн дараагийн өөрчлөлтийг автоматаар тусгахгүй.",
    "Суурь шалтгааны хэсэг нь статистик indicator бөгөөд баталгаажсан шалтгаан биш.",
  ],
  sourceSummary: [
    { system: "Хяналт шалгалт", count: 55, high: 8 },
    { system: "Журмын биелэлт", count: 73, high: 10 },
  ],
};

const [docx, pdf] = await Promise.all([
  renderFormalReportDocx(report),
  renderFormalReportPdf(report),
]);

await Promise.all([
  writeFile(resolve(outputDir, "formal-report-qa.docx"), docx),
  writeFile(resolve(outputDir, "formal-report-qa.pdf"), pdf),
]);

console.log(JSON.stringify({ outputDir, docxBytes: docx.length, pdfBytes: pdf.length }));
