import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import type { ConsolidatedReportExportInput } from "@/lib/runs/export-consolidated-word";

type PdfMakeApi = {
  vfs: Record<string, string>;
  createPdf: (
    doc: TDocumentDefinitions,
  ) => {
    getBuffer: (cb: (result: Buffer) => void) => void;
  };
};

const pdf = pdfMake as unknown as PdfMakeApi;
pdf.vfs = pdfFonts as unknown as Record<string, string>;

function reportLabels(inspectionType?: "JOINT_INSPECTION" | "NIGHT_INSPECTION") {
  const isNight = inspectionType === "NIGHT_INSPECTION";
  return {
    mainHeading: isNight
      ? "Шөнийн хяналт шалгалтын тайлан"
      : "Хамтарсан хяналт шалгалтын тайлан",
    reportSubtitle: isNight
      ? "Ажлын байрны шөнийн хяналт шалгалтын хуудас"
      : "Ажлын байрны хамтарсан хяналт шалгалтын хуудас",
    checkingTeam: isNight ? "ДХШХ" : "ДХШХ, БОХ, ХАБЭАХ",
  };
}

function cell(text: string): Content {
  return { text: text || "—", fontSize: 8 };
}

function headerCell(text: string): Content {
  return {
    text,
    style: "tableHeader",
    fontSize: 8,
    alignment: "center",
  };
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

export async function renderConsolidatedReportPdf(
  input: ConsolidatedReportExportInput,
): Promise<Buffer> {
  const labels = reportLabels(input.inspectionType);
  const org = input.inspectedByOrg || "“Болдтөмөр Ерөө гол” ХХК";
  const units =
    input.report.inspectedUnits
      .map((unit, index) => `${index + 1}. ${unit}`)
      .join(", ") || "—";
  const performers = (input.performers ?? [])
    .filter((row) => row.name.trim() || row.position.trim())
    .map((row) => {
      const name = row.name.trim() || "—";
      const position = row.position.trim();
      return position ? `${name} (${position})` : name;
    })
    .join(" · ");

  const content: Content[] = [
    { text: labels.mainHeading, style: "title" },
    {
      text: "Work Place Inspection Report Form",
      style: "subtitle",
      margin: [0, 2, 0, 0],
    },
    { text: labels.reportSubtitle, style: "subtitle", margin: [0, 0, 0, 8] },
    {
      text: [
        { text: "ХШ гүйцэтгэсэн ажилтан: ", bold: true },
        performers || "Нэр, албан тушаал бүртгээгүй",
      ],
      fontSize: 9,
      margin: [0, 0, 0, 6],
    },
    {
      columns: [
        {
          text: [
            { text: "Байгууллага: ", bold: true },
            org,
          ],
          fontSize: 9,
        },
        {
          text: [
            { text: "Шалгах баг: ", bold: true },
            labels.checkingTeam,
          ],
          fontSize: 9,
        },
        {
          text: [
            { text: "Огноо: ", bold: true },
            input.inspectionDate,
          ],
          fontSize: 9,
        },
      ],
      margin: [0, 0, 0, 4],
    },
    {
      text: [
        {
          text: "Inspection place / Шалгалт хийсэн хэлтэс, алба: ",
          bold: true,
        },
        units,
      ],
      fontSize: 9,
      margin: [0, 0, 0, 2],
    },
    {
      text: [{ text: "Гарчиг: ", bold: true }, input.runTitle],
      fontSize: 9,
      margin: [0, 0, 0, 8],
    },
    {
      text: "NON-STANDARD CONDITIONS / СТАНДАРТ БУС НӨХЦӨЛ / ҮЙЛДЭЛ",
      bold: true,
      fontSize: 10,
      margin: [0, 0, 0, 8],
    },
  ];

  if (input.report.byCategory.length === 0) {
    content.push({
      text: "Зөрчил / үл тохирол бүртгэгдээгүй.",
      italics: true,
      color: "#64748b",
    });
  } else {
    for (const section of input.report.byCategory) {
      content.push({
        text: section.category,
        style: "category",
        margin: [0, 10, 0, 0],
      });
      content.push({
        table: {
          headerRows: 1,
          widths: [36, 70, "*", 42, "*", 70, 55, 48],
          body: [
            [
              headerCell("Аюулын зэрэг"),
              headerCell("Хэлтэс, алба"),
              headerCell("Зөрчил, үл тохирол"),
              headerCell("Зураг"),
              headerCell("Шаардлагатай авсан арга хэмжээ"),
              headerCell("Хариуцсан хүн"),
              headerCell("Дуусах хугацаа"),
              headerCell("Гүйцэтгэлийн зураг"),
            ],
            ...section.items.map((item) => [
              {
                text: item.hazardClass || "—",
                bold: true,
                alignment: "center" as const,
                fontSize: 9,
              },
              cell(item.department),
              {
                stack: [
                  { text: item.disagreement || "—", fontSize: 8 },
                  {
                    text: `№${item.questionNo}`,
                    fontSize: 7,
                    color: "#64748b",
                    margin: [0, 2, 0, 0],
                  },
                ],
              },
              {
                text: item.photoUrl ? "зурагтай" : "—",
                alignment: "center" as const,
                fontSize: 8,
              },
              cell(item.actionRequired),
              cell(item.responsiblePerson || "—"),
              {
                text: item.targetDate || "—",
                alignment: "center" as const,
                fontSize: 8,
              },
              { text: "—", alignment: "center" as const, fontSize: 8 },
            ]),
          ],
        },
        layout: {
          fillColor: (rowIndex: number) =>
            rowIndex === 0 ? "#f1f5f9" : null,
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => "#334155",
          vLineColor: () => "#334155",
        },
        margin: [0, 0, 0, 4],
      });
    }
  }

  content.push({
    text:
      "Аюулын зэрэг: A зэрэг (Үлэмж — нэн даруй хийх), B зэрэг (ноцтой), C зэрэг (дунд), D зэрэг (жижиг)",
    fontSize: 8,
    color: "#475569",
    margin: [0, 10, 0, 0],
  });

  const doc: TDocumentDefinitions = {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [28, 32, 28, 32],
    defaultStyle: {
      font: "Roboto",
      fontSize: 9,
      color: "#0f172a",
      lineHeight: 1.15,
    },
    styles: {
      title: {
        fontSize: 14,
        bold: true,
        alignment: "center",
      },
      subtitle: {
        fontSize: 9,
        alignment: "center",
        color: "#64748b",
      },
      category: {
        fontSize: 10,
        bold: true,
        color: "#ffffff",
        fillColor: "#1e293b",
        margin: [0, 0, 0, 0],
      },
      tableHeader: {
        bold: true,
        fillColor: "#f1f5f9",
        color: "#0f172a",
      },
    },
    content,
  };

  return getPdfBuffer(doc);
}
