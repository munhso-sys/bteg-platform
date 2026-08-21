import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import type { FormalReport } from "@/lib/reports/formal-report";

const ORANGE = "EA580C";
const NAVY = "0F172A";
const MUTED = "64748B";
const BORDER = "CBD5E1";
const CONTENT_WIDTH = 9360;

function text(value: string, options?: { bold?: boolean; color?: string; size?: number }) {
  return new TextRun({
    text: value,
    font: "Arial",
    bold: options?.bold,
    color: options?.color ?? NAVY,
    size: options?.size ?? 20,
  });
}

function heading(value: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 100 },
    children: [text(value, { bold: true, color: ORANGE, size: 26 })],
  });
}

function bullet(value: string) {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 70, line: 300 },
    children: [text(value)],
  });
}

function cell(value: string, width: number, bold = false) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    margins: { top: 90, bottom: 90, left: 110, right: 110 },
    children: [
      new Paragraph({
        spacing: { after: 0 },
        children: [text(value || "—", { bold, size: 18 })],
      }),
    ],
  });
}

function table(rows: string[][], widths: number[]) {
  const borders = {
    top: { style: BorderStyle.SINGLE, size: 1, color: BORDER },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: BORDER },
    left: { style: BorderStyle.SINGLE, size: 1, color: BORDER },
    right: { style: BorderStyle.SINGLE, size: 1, color: BORDER },
    insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: BORDER },
    insideVertical: { style: BorderStyle.SINGLE, size: 1, color: BORDER },
  };
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    borders,
    rows: rows.map(
      (row, rowIndex) =>
        new TableRow({
          tableHeader: rowIndex === 0,
          cantSplit: true,
          children: row.map((value, index) => cell(value, widths[index], rowIndex === 0)),
        }),
    ),
  });
}

export async function renderFormalReportDocx(report: FormalReport) {
  const children: Array<Paragraph | Table> = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [text("INSPECT-MN · BTEG", { bold: true, color: ORANGE, size: 22 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
      children: [text(report.title, { bold: true, size: 34 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [text(report.subtitle, { color: MUTED, size: 21 })],
    }),
    table(
      [
        ["Баримтын дугаар", report.documentId],
        ["Хугацаа", report.periodLabel],
        ["Үүсгэсэн", new Date(report.generatedAt).toLocaleString("mn-MN")],
      ],
      [2200, 7160],
    ),
    heading("1. Удирдлагын хураангуй"),
    ...report.executiveSummary.map(bullet),
    heading("2. Гол KPI"),
    table(
      [
        ["Үзүүлэлт", "Утга", "Тайлбар"],
        ...report.kpis.map((item) => [item.label, item.value, item.interpretation]),
      ],
      [3200, 1300, 4860],
    ),
    heading("3. Арга зүй ба хамрах хүрээ"),
    ...report.methodology.map(bullet),
    heading("4. Суурь шалтгааны дохио"),
    ...(report.rootCauseSignals.length
      ? report.rootCauseSignals.flatMap((item) => [
          new Paragraph({
            spacing: { before: 100, after: 40 },
            children: [text(item.title, { bold: true })],
          }),
          bullet(item.evidence),
          bullet(`Арга: ${item.method}`),
          bullet("Статус: өгөгдлийн indicator; баталгаажсан root cause биш."),
        ])
      : [bullet("Одоогийн snapshot-д суурь шалтгааны статистик дохио үүсээгүй.")]),
    heading("5. Нэн тэргүүний олдвор"),
    table(
      [
        ["Огноо", "Систем / нэгж", "Олдвор", "Эрсдэл", "Төлөв / эзэн"],
        ...report.priorityFindings.map((item) => [
          item.date,
          `${item.system}\n${item.unit}`,
          item.title,
          item.severity,
          `${item.status}\n${item.owner}`,
        ]),
      ],
      [1100, 1800, 3360, 1200, 1900],
    ),
    heading("6. Зөвлөмж, арга хэмжээ"),
    ...report.recommendations.map(bullet),
    heading("7. Өгөгдлийн эх үүсвэр"),
    table(
      [
        ["Систем", "Нийт дохио", "Өндөр/ноцтой"],
        ...report.sourceSummary.map((item) => [item.system, String(item.count), String(item.high)]),
      ],
      [5360, 2000, 2000],
    ),
    heading("8. Хязгаарлалт ба баталгаажуулалт"),
    ...report.limitations.map(bullet),
  ];

  const doc = new Document({
    creator: "INSPECT-MN Platform",
    title: report.title,
    description: report.subtitle,
    styles: {
      default: {
        document: { run: { font: "Arial", size: 20, color: NAVY } },
        heading1: { run: { font: "Arial", size: 26, bold: true, color: ORANGE } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  text("INSPECT-MN · Албан хэрэглээнд · ", { color: MUTED, size: 16 }),
                  new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 16 }),
                  text(" / ", { color: MUTED, size: 16 }),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], color: MUTED, size: 16 }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}

