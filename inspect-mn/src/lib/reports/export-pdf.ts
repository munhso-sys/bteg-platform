import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { FormalReport } from "@/lib/reports/formal-report";

type PdfMakeWithVfs = typeof pdfMake & { vfs: Record<string, string> };
(pdfMake as PdfMakeWithVfs).vfs = pdfFonts as Record<string, string>;

function bullets(values: string[]): Content {
  return { ul: values.length ? values : ["Мэдээлэл алга"], margin: [0, 0, 0, 8] };
}

function section(title: string): Content {
  return { text: title, style: "section", margin: [0, 12, 0, 6] };
}

export async function renderFormalReportPdf(report: FormalReport): Promise<Buffer> {
  const doc: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [42, 48, 42, 48],
    defaultStyle: { font: "Roboto", fontSize: 9.5, color: "#0f172a", lineHeight: 1.2 },
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: "INSPECT-MN · Албан хэрэглээнд", color: "#64748b", fontSize: 8 },
        { text: `${currentPage} / ${pageCount}`, alignment: "right", color: "#64748b", fontSize: 8 },
      ],
      margin: [42, 12, 42, 0],
    }),
    styles: {
      brand: { fontSize: 10, bold: true, color: "#ea580c", alignment: "center" },
      title: { fontSize: 18, bold: true, alignment: "center", color: "#0f172a" },
      subtitle: { fontSize: 10, alignment: "center", color: "#64748b" },
      section: { fontSize: 12, bold: true, color: "#ea580c" },
      tableHeader: { bold: true, color: "#0f172a", fillColor: "#f1f5f9" },
    },
    content: [
      { text: "INSPECT-MN · BTEG", style: "brand" },
      { text: report.title, style: "title", margin: [0, 8, 0, 4] },
      { text: report.subtitle, style: "subtitle", margin: [0, 0, 0, 14] },
      {
        table: {
          widths: [110, "*"],
          body: [
            ["Баримтын дугаар", report.documentId],
            ["Хугацаа", report.periodLabel],
            ["Үүсгэсэн", new Date(report.generatedAt).toLocaleString("mn-MN")],
          ],
        },
        layout: "lightHorizontalLines",
      },
      section("1. Удирдлагын хураангуй"),
      bullets(report.executiveSummary),
      section("2. Гол KPI"),
      {
        table: {
          headerRows: 1,
          widths: [150, 65, "*"],
          body: [
            [
              { text: "Үзүүлэлт", style: "tableHeader" },
              { text: "Утга", style: "tableHeader" },
              { text: "Тайлбар", style: "tableHeader" },
            ],
            ...report.kpis.map((item) => [item.label, item.value, item.interpretation]),
          ],
        },
        layout: "lightHorizontalLines",
      },
      section("3. Арга зүй ба хамрах хүрээ"),
      bullets(report.methodology),
      section("4. Суурь шалтгааны дохио"),
      ...(report.rootCauseSignals.length
        ? report.rootCauseSignals.map((item) => ({
            stack: [
              { text: item.title, bold: true, margin: [0, 2, 0, 2] },
              { text: item.evidence },
              { text: `Арга: ${item.method}`, color: "#475569", fontSize: 8.5 },
              { text: "Статус: өгөгдлийн indicator; баталгаажсан root cause биш.", italics: true, color: "#b45309", fontSize: 8.5 },
            ],
            margin: [0, 0, 0, 8],
          }) as Content)
        : [bullets(["Одоогийн snapshot-д суурь шалтгааны статистик дохио үүсээгүй."])]),
      section("5. Нэн тэргүүний олдвор"),
      {
        table: {
          headerRows: 1,
          widths: [55, 92, "*", 48, 75],
          body: [
            ["Огноо", "Систем / нэгж", "Олдвор", "Эрсдэл", "Төлөв / эзэн"].map((value) => ({ text: value, style: "tableHeader" })),
            ...report.priorityFindings.map((item) => [
              item.date,
              `${item.system}\n${item.unit}`,
              item.title,
              item.severity,
              `${item.status}\n${item.owner}`,
            ]),
          ],
        },
        layout: "lightHorizontalLines",
        fontSize: 8,
      },
      section("6. Зөвлөмж, арга хэмжээ"),
      bullets(report.recommendations),
      section("7. Өгөгдлийн эх үүсвэр"),
      {
        table: {
          headerRows: 1,
          widths: ["*", 90, 90],
          body: [
            ["Систем", "Нийт дохио", "Өндөр/ноцтой"].map((value) => ({ text: value, style: "tableHeader" })),
            ...report.sourceSummary.map((item) => [item.system, String(item.count), String(item.high)]),
          ],
        },
        layout: "lightHorizontalLines",
      },
      section("8. Хязгаарлалт ба баталгаажуулалт"),
      bullets(report.limitations),
    ],
  };

  return Buffer.from(await pdfMake.createPdf(doc).getBuffer());
}
