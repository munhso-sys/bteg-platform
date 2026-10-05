import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { PositionReviewRow } from "@/lib/org-assign";
import { POLICY_PAGE_MARGINS } from "@/lib/policy-document";
import {
  buildPositionReviewTree,
  fmtReviewScore,
  scopeSubtitle,
  scopeTitle,
  type PositionReviewScope,
} from "@/lib/position-review-document";

type PdfMakeApi = {
  vfs: Record<string, string>;
  createPdf: (doc: TDocumentDefinitions) => {
    getBuffer: (cb: (result: Buffer) => void) => void;
  };
};

const pdf = pdfMake as unknown as PdfMakeApi;
pdf.vfs = pdfFonts as unknown as Record<string, string>;

function cmToPt(cm: number) {
  return cm * 28.3465;
}

function getPdfBuffer(doc: TDocumentDefinitions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      pdf.createPdf(doc).getBuffer((result) => {
        resolve(Buffer.from(result));
      });
    } catch (error) {
      reject(error);
    }
  });
}

function formatExportDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const COL_HEADERS = [
  "№",
  "Ажлын байр",
  "Албан тушаалын код",
  "Ж-үнэлгээ",
  "Журмын тоо",
  "Заалтын тоо",
  "Тодорхойлолт",
  "Т-үнэлгээ",
];

function headerRow(): Content[] {
  return COL_HEADERS.map((text) => ({
    text,
    style: "tableHeader",
  }));
}

function dataRow(r: PositionReviewRow, index: number): Content[] {
  return [
    { text: String(index), fontSize: 8, alignment: "center" },
    { text: r.name, fontSize: 8 },
    {
      text: r.official_code || "—",
      fontSize: 8,
      alignment: "center",
    },
    {
      text: fmtReviewScore(r.policy_avg_score),
      fontSize: 8,
      alignment: "center",
    },
    {
      text: String(r.policy_count),
      fontSize: 8,
      alignment: "center",
    },
    {
      text: String(r.clause_count),
      fontSize: 8,
      alignment: "center",
    },
    {
      text: r.has_job_description ? "Тийм" : "Үгүй",
      fontSize: 8,
      alignment: "center",
    },
    {
      text: fmtReviewScore(r.description_score),
      fontSize: 8,
      alignment: "center",
    },
  ];
}

export async function renderPositionReviewPdf(
  rows: PositionReviewRow[],
  scope: PositionReviewScope,
): Promise<Buffer> {
  const tree = buildPositionReviewTree(rows);
  const content: Content[] = [
    {
      text: "Журмын биелэлт · Шалгах",
      alignment: "center",
      fontSize: 9,
      margin: [0, 0, 0, 4],
    },
    {
      text: "АЖЛЫН БАЙРНЫ ШАЛГАЛТЫН ЖАГСААЛТ",
      style: "title",
      alignment: "center",
      margin: [0, 0, 0, 6],
    },
    {
      text: scopeSubtitle(scope),
      alignment: "center",
      fontSize: 9,
      margin: [0, 0, 0, 2],
    },
    {
      text: `Нийт ${rows.length} ажлын байр · Экспортын огноо: ${formatExportDate()}`,
      alignment: "center",
      fontSize: 9,
      margin: [0, 0, 0, 12],
    },
  ];

  let counter = 0;

  if (!rows.length) {
    content.push({
      text: "Сонгосон хүрээнд ажлын байр олдсонгүй.",
      alignment: "center",
      margin: [0, 24, 0, 0],
    });
  }

  for (const org of tree) {
    content.push({
      text: org.label,
      style: "orgHeading",
      margin: [0, 10, 0, 4],
    });
    for (const heltes of org.heltes) {
      content.push({
        text: heltes.label,
        style: "heltesHeading",
        margin: [0, 6, 0, 2],
      });
      for (const alba of heltes.albas) {
        content.push({
          text: `${alba.label} (${alba.items.length})`,
          style: "albaHeading",
          margin: [0, 4, 0, 4],
        });
        const body: Content[][] = [headerRow()];
        for (const r of alba.items) {
          counter += 1;
          body.push(dataRow(r, counter));
        }
        content.push({
          table: {
            headerRows: 1,
            widths: [
              22,
              "*",
              70,
              42,
              42,
              42,
              42,
              42,
            ],
            body,
          },
          layout: {
            hLineWidth: () => 0.6,
            vLineWidth: () => 0.6,
            hLineColor: () => "#333333",
            vLineColor: () => "#666666",
          },
          margin: [0, 0, 0, 8],
        });
      }
    }
  }

  const m = POLICY_PAGE_MARGINS;
  const doc: TDocumentDefinitions = {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [
      cmToPt(m.leftCm),
      cmToPt(m.topCm),
      cmToPt(m.rightCm),
      cmToPt(m.bottomCm),
    ],
    info: {
      title: scopeTitle(scope),
      subject: "Ажлын байрны шалгалтын жагсаалт",
    },
    content,
    defaultStyle: { font: "Roboto", fontSize: 9 },
    styles: {
      title: { fontSize: 13, bold: true },
      orgHeading: { fontSize: 11, bold: true },
      heltesHeading: { fontSize: 10, bold: true },
      albaHeading: { fontSize: 9, bold: true },
      tableHeader: {
        fontSize: 7,
        bold: true,
        alignment: "center",
        fillColor: "#f0f0f0",
      },
    },
  };

  return getPdfBuffer(doc);
}
