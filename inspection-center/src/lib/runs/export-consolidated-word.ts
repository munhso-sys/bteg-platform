import type { ConsolidatedReport } from "@/lib/runs/consolidated-report";

/** Match PDF print size: print:w-28 (7rem/112px) × print:h-24 (6rem/96px) */
const PHOTO_WIDTH_PX = 112;
const PHOTO_HEIGHT_PX = 96;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cell(value: string, opts?: { center?: boolean; bold?: boolean }) {
  const align = opts?.center ? "center" : "left";
  const weight = opts?.bold ? "bold" : "normal";
  return `<td style="border:1px solid #333;padding:4px;vertical-align:top;text-align:${align};font-weight:${weight};">${value || "—"}</td>`;
}

function photoCell(photoUrl: string | null) {
  if (!photoUrl) return cell("—", { center: true });
  return `<td style="border:1px solid #333;padding:4px;text-align:center;vertical-align:middle;width:${PHOTO_WIDTH_PX + 8}px;">
    <img src="${photoUrl}" width="${PHOTO_WIDTH_PX}" height="${PHOTO_HEIGHT_PX}" style="width:${PHOTO_WIDTH_PX}px;height:${PHOTO_HEIGHT_PX}px;object-fit:cover;" />
  </td>`;
}

export function buildConsolidatedReportWordHtml(input: {
  report: ConsolidatedReport;
  runTitle: string;
  inspectionDate: string;
  inspectedByOrg?: string;
  performers?: Array<{ name: string; position: string }>;
}): string {
  const org = escapeHtml(
    input.inspectedByOrg || "“Болдтөмөр Ерөө гол” ХХК",
  );
  const date = escapeHtml(input.inspectionDate);
  const title = escapeHtml(input.runTitle);
  const units = input.report.inspectedUnits
    .map((unit, index) => `${index + 1}. ${escapeHtml(unit)}`)
    .join(", ");
  const performers = (input.performers ?? [])
    .filter((row) => row.name.trim() || row.position.trim())
    .map((row) => {
      const name = escapeHtml(row.name.trim() || "—");
      const position = escapeHtml(row.position.trim());
      return position ? `${name} (${position})` : name;
    })
    .join(" · ");

  const sections =
    input.report.byCategory.length === 0
      ? `<p>Зөрчил / үл тохирол бүртгэгдээгүй.</p>`
      : input.report.byCategory
          .map((section) => {
            const rows = section.items
              .map((item) => {
                const disagreement = `${escapeHtml(item.disagreement)}<div style="color:#666;font-size:9pt;margin-top:3px;">№${escapeHtml(item.questionNo)}</div>`;
                return `<tr>
                  ${cell(escapeHtml(item.hazardClass), { center: true, bold: true })}
                  ${cell(escapeHtml(item.department))}
                  ${cell(disagreement)}
                  ${photoCell(item.photoUrl)}
                  ${cell(escapeHtml(item.actionRequired))}
                  ${cell(escapeHtml(item.responsiblePerson || "—"))}
                  ${cell(escapeHtml(item.targetDate || "—"), { center: true })}
                  ${cell("—", { center: true })}
                </tr>`;
              })
              .join("");

            return `
              <h3 style="background:#1e293b;color:#fff;padding:6px 8px;margin:14px 0 0;font-size:11pt;">${escapeHtml(section.category)}</h3>
              <table style="border-collapse:collapse;width:100%;font-size:9pt;table-layout:fixed;">
                <thead>
                  <tr style="background:#f1f5f9;">
                    <th style="border:1px solid #333;padding:4px;width:6%;">Аюулын зэрэг</th>
                    <th style="border:1px solid #333;padding:4px;width:10%;">Хэлтэс, алба</th>
                    <th style="border:1px solid #333;padding:4px;width:22%;">Зөрчил, үл тохирол</th>
                    <th style="border:1px solid #333;padding:4px;width:12%;">Зураг</th>
                    <th style="border:1px solid #333;padding:4px;width:18%;">Шаардлагатай авсан арга хэмжээ</th>
                    <th style="border:1px solid #333;padding:4px;width:12%;">Хариуцсан хүн</th>
                    <th style="border:1px solid #333;padding:4px;width:10%;">Дуусах хугацаа</th>
                    <th style="border:1px solid #333;padding:4px;width:10%;">Гүйцэтгэлийн зураг</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            `;
          })
          .join("");

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      lang="mn">
<head>
  <meta charset="utf-8" />
  <title>Шөнийн хяналт шалгалтын тайлан</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    /* A4 landscape + Word Narrow margins (0.5in) */
    @page WordSection1 {
      size: 297mm 210mm;
      margin: 0.5in 0.5in 0.5in 0.5in;
      mso-page-orientation: landscape;
    }
    div.WordSection1 {
      page: WordSection1;
    }
    body { font-family: "Times New Roman", Times, serif; font-size: 11pt; color: #111; }
    h1 { font-size: 14pt; text-align: center; margin: 0 0 2pt; }
    .sub { text-align: center; color: #555; font-size: 9pt; margin: 0; }
    .meta td { padding: 1pt 8pt 1pt 0; vertical-align: top; font-size: 10pt; }
    img { width: ${PHOTO_WIDTH_PX}px; height: ${PHOTO_HEIGHT_PX}px; }
  </style>
</head>
<body>
  <div class="WordSection1">
    <h1>Шөнийн хяналт шалгалтын тайлан</h1>
    <p class="sub">Work Place Inspection Report Form</p>
    <p class="sub">Ажлын байрны хамтарсан хяналт шалгалтын хуудас</p>
    <p style="margin-top:8px;font-size:10pt;">
      <b>ХШ гүйцэтгэсэн ажилтан:</b>
      ${performers || "Нэр, албан тушаал бүртгээгүй"}
    </p>

    <table class="meta" style="margin-top:10px;width:100%;">
      <tr>
        <td><b>Байгууллага:</b> ${org}</td>
        <td><b>Шалгах баг:</b> ДХШХ, БОХ, ХАБЭАХ</td>
        <td><b>Огноо:</b> ${date}</td>
      </tr>
    </table>

    <p style="margin-top:8px;">
      <b>Inspection place / Шалгалт хийсэн хэлтэс, алба:</b>
      ${units || "—"}
    </p>
    <p><b>Гарчиг:</b> ${title}</p>

    <p style="margin-top:12px;font-weight:bold;text-transform:uppercase;">
      Non-STANDARD CONDITIONS / СТАНДАРТ БУС НӨХЦӨЛ / ҮЙЛДЭЛ
    </p>

    ${sections}

    <p style="margin-top:12px;font-size:9pt;color:#444;">
      Аюулын зэрэг: A зэрэг (Үлэмж — нэн даруй хийх), B зэрэг (ноцтой),
      C зэрэг (дунд), D зэрэг (жижиг)
    </p>
  </div>
</body>
</html>`;
}

export function downloadConsolidatedReportWord(input: {
  report: ConsolidatedReport;
  runTitle: string;
  inspectionDate: string;
  inspectedByOrg?: string;
  performers?: Array<{ name: string; position: string }>;
  filename?: string;
}) {
  const html = buildConsolidatedReportWordHtml(input);
  const blob = new Blob(["\ufeff", html], {
    type: "application/msword;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${input.filename || "hamtarsan-ul-tohirol"}.doc`;
  link.click();
  URL.revokeObjectURL(url);
}
