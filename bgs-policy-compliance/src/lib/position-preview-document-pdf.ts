import pdfMake from "pdfmake/build/pdfmake.js";
import pdfFonts from "pdfmake/build/vfs_fonts.js";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces";
import {
  COMPLIANCE_STATUS_LABELS,
  RESPONSIBILITY_SHORT,
} from "@/lib/constants";
import {
  asCommunication,
  asSkillCategories,
  asTextList,
  documentHeading,
  JD_DEFAULT_COMPANY,
  JD_DEFAULT_LOCATION,
} from "@/lib/job-description/normalize";
import { POLICY_PAGE_MARGINS } from "@/lib/policy-document";
import type {
  PositionPreviewExportModel,
  PositionPreviewObligation,
} from "@/lib/position-preview-document";
import type { ResponsibilityType } from "@/lib/types";
import type { ScoreSnapshot, ScoreTrendPoint } from "@/lib/score-trend";

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

function fmtScore(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function formatExportDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function textOrDash(v: string | null | undefined): string {
  const t = (v ?? "").trim();
  return t || "—";
}

function numbered(items: string[]): Content {
  if (!items.length) return { text: "—", fontSize: 10 };
  return {
    ol: items.map((i) => ({ text: i, fontSize: 10 })),
    margin: [0, 0, 0, 0],
  };
}

function sectionTitle(text: string): Content {
  return {
    text,
    style: "section",
    margin: [0, 14, 0, 6],
  };
}

function kvTable(
  rows: Array<[string, string | Content]>,
): Content {
  return {
    table: {
      widths: ["34%", "*"],
      body: rows.map(([label, value]) => [
        {
          text: label,
          bold: true,
          fontSize: 9,
          fillColor: "#f5f5f5",
        },
        typeof value === "string"
          ? { text: value, fontSize: 10 }
          : value,
      ]),
    },
    layout: {
      hLineWidth: () => 0.6,
      vLineWidth: () => 0.6,
      hLineColor: () => "#333333",
      vLineColor: () => "#666666",
    },
    margin: [0, 0, 0, 8],
  };
}

function groupObligations(rows: PositionPreviewObligation[]) {
  const byPolicy = new Map<
    string,
    {
      label: string;
      code: string | null;
      byClause: Map<
        string,
        { ref: string; text: string; rows: PositionPreviewObligation[] }
      >;
    }
  >();

  for (const r of rows) {
    const policyId = r.policy?.id ?? "__none__";
    if (!byPolicy.has(policyId)) {
      byPolicy.set(policyId, {
        label: r.policy?.name?.trim() || "Ангилагдаагүй журам",
        code: r.policy?.reference_code ?? null,
        byClause: new Map(),
      });
    }
    const pg = byPolicy.get(policyId)!;
    const clauseId = r.clause?.id ?? "__none__";
    if (!pg.byClause.has(clauseId)) {
      pg.byClause.set(clauseId, {
        ref: r.clause?.reference_number?.trim() || "—",
        text: r.clause?.text?.trim() || "Зүйлгүй",
        rows: [],
      });
    }
    pg.byClause.get(clauseId)!.rows.push(r);
  }

  return [...byPolicy.values()]
    .map((pg) => ({
      ...pg,
      clauses: [...pg.byClause.values()].sort((a, b) =>
        a.ref.localeCompare(b.ref, "mn", { numeric: true }),
      ),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, "mn"));
}

function obligationsContent(rows: PositionPreviewObligation[]): Content[] {
  if (!rows.length) {
    return [{ text: "Журмын үүрэг бүртгэгдээгүй.", fontSize: 10 }];
  }
  const out: Content[] = [];
  for (const g of groupObligations(rows)) {
    out.push({
      text: g.code ? `${g.label} (${g.code})` : g.label,
      bold: true,
      fontSize: 11,
      margin: [0, 8, 0, 4],
    });
    for (const c of g.clauses) {
      out.push({
        text: [
          { text: `${c.ref}. `, bold: true },
          { text: c.text },
        ],
        fontSize: 10,
        alignment: "justify",
        margin: [0, 2, 0, 4],
      });
      out.push({
        table: {
          widths: ["22%", 40, 70, "*"],
          body: [
            [
              { text: "Үүрэг", style: "tableHeader" },
              { text: "Оноо", style: "tableHeader" },
              { text: "Төлөв", style: "tableHeader" },
              { text: "Үе / тэмдэглэл", style: "tableHeader" },
            ],
            ...c.rows.map((r) => [
              {
                text: RESPONSIBILITY_SHORT[r.link.responsibility_type],
                fontSize: 9,
              },
              {
                text: fmtScore(r.evaluation?.score),
                fontSize: 9,
                alignment: "center" as const,
              },
              {
                text: r.evaluation?.status
                  ? COMPLIANCE_STATUS_LABELS[r.evaluation.status]
                  : "—",
                fontSize: 9,
                alignment: "center" as const,
              },
              {
                text: [r.evaluation?.evaluation_period, r.evaluation?.comment]
                  .filter(Boolean)
                  .join(" · ") || "—",
                fontSize: 9,
              },
            ]),
          ],
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => "#666666",
          vLineColor: () => "#666666",
        },
        margin: [0, 0, 0, 6],
      });
    }
  }
  return out;
}

function trendContent(
  points: ScoreTrendPoint[],
  snapshot: ScoreSnapshot,
): Content[] {
  const typeOrder: ResponsibilityType[] = [
    "IMPLEMENTATION",
    "MONITORING",
    "VERIFICATION",
    "DEPLOYMENT",
  ];
  const chips = [
    ["Ж-үнэлгээ", fmtScore(snapshot.j_avg)],
    ...typeOrder.map((t) => [
      RESPONSIBILITY_SHORT[t],
      fmtScore(snapshot.byType[t]),
    ]),
    ["Т-үнэлгээ", fmtScore(snapshot.t_score)],
  ];

  const out: Content[] = [
    {
      table: {
        widths: chips.map(() => "*"),
        body: [
          chips.map(([label, value]) => ({
            stack: [
              {
                text: label,
                fontSize: 7,
                alignment: "center" as const,
              },
              {
                text: value,
                fontSize: 12,
                bold: true,
                alignment: "center" as const,
                margin: [0, 2, 0, 0] as [number, number, number, number],
              },
            ],
          })),
        ],
      },
      layout: {
        hLineWidth: () => 0.6,
        vLineWidth: () => 0.6,
        hLineColor: () => "#333333",
        vLineColor: () => "#666666",
      },
      margin: [0, 0, 0, 8],
    },
  ];

  if (!points.length) {
    out.push({ text: "Үнэлгээний хандлагын өгөгдөл байхгүй.", fontSize: 10 });
    return out;
  }

  out.push({
    text: "Үе бүрийн cumulative дундаж (Шалгах дэлгэц дээрх онооны хандлага).",
    fontSize: 8,
    color: "#333333",
    margin: [0, 0, 0, 4],
  });
  out.push({
    table: {
      headerRows: 1,
      widths: [50, "*", "*", "*", "*", "*", "*"],
      body: [
        ["Үе", "Ж", "Гүйцэтгэх", "Хянах", "Баталгаажуулах", "Нэвтрүүлэх", "Т"].map(
          (t) => ({ text: t, style: "tableHeader" }),
        ),
        ...points.map((p) => [
          { text: p.period, fontSize: 8, alignment: "center" as const },
          {
            text: fmtScore(p.j_avg),
            fontSize: 8,
            alignment: "center" as const,
          },
          {
            text: fmtScore(p.implementation),
            fontSize: 8,
            alignment: "center" as const,
          },
          {
            text: fmtScore(p.monitoring),
            fontSize: 8,
            alignment: "center" as const,
          },
          {
            text: fmtScore(p.verification),
            fontSize: 8,
            alignment: "center" as const,
          },
          {
            text: fmtScore(p.deployment),
            fontSize: 8,
            alignment: "center" as const,
          },
          {
            text: fmtScore(p.t_score),
            fontSize: 8,
            alignment: "center" as const,
          },
        ]),
      ],
    },
    layout: {
      hLineWidth: () => 0.5,
      vLineWidth: () => 0.5,
      hLineColor: () => "#666666",
      vLineColor: () => "#666666",
    },
  });
  return out;
}

function jdContent(model: PositionPreviewExportModel): Content[] {
  const d = model.description;
  if (!d) {
    return [{ text: "Ажлын байрны тодорхойлолт байхгүй.", fontSize: 10 }];
  }
  const skillCats = asSkillCategories(d.professional_skills);
  const skillValue: Content = skillCats.length
    ? {
        stack: skillCats.map((c) => ({
          stack: [
            { text: c.title, bold: true, fontSize: 10, margin: [0, 2, 0, 1] },
            numbered(c.items),
          ],
        })),
      }
    : numbered(asTextList(d.professional_skills));

  const comm = asCommunication(d.communication_scope);
  const commValue: Content =
    comm.internal.trim() || comm.external.trim()
      ? {
          stack: [
            {
              text: [
                { text: "Дотоод: ", bold: true },
                { text: textOrDash(comm.internal) },
              ],
              fontSize: 10,
            },
            {
              text: [
                { text: "Гадаад: ", bold: true },
                { text: textOrDash(comm.external) },
              ],
              fontSize: 10,
              margin: [0, 4, 0, 0],
            },
          ],
        }
      : { text: "—", fontSize: 10 };

  return [
    {
      text: documentHeading(d).toUpperCase(),
      alignment: "center",
      bold: true,
      fontSize: 11,
      margin: [0, 0, 0, 2],
    },
    {
      text: "Албан тушаалын тодорхойлолт",
      alignment: "center",
      fontSize: 9,
      margin: [0, 0, 0, 8],
    },
    kvTable([
      ["Байгууллага", textOrDash(d.company_name || JD_DEFAULT_COMPANY)],
      ["Байршил", textOrDash(d.location || JD_DEFAULT_LOCATION)],
      ["Нэгж", textOrDash(d.unit_name)],
      ["Албан тушаалын код", textOrDash(d.position_code)],
      ["ҮАМА код", textOrDash(d.a_code)],
    ]),
    { text: "А. Нийтлэг үндэслэл", bold: true, fontSize: 11, margin: [0, 8, 0, 4] },
    kvTable([
      ["Зорилго", textOrDash(d.purpose)],
      ["Ажлын цаг", textOrDash(d.schedule)],
      ["Өдрийн цаг", textOrDash(d.daily_hours)],
      ["Амралт", textOrDash(d.break_time)],
      ["Албан тушаал", textOrDash(d.position_note)],
    ]),
    { text: "Б. Үүрэг, эрх хэмжээ", bold: true, fontSize: 11, margin: [0, 8, 0, 4] },
    kvTable([
      ["Үндсэн үүрэг", numbered(asTextList(d.duties))],
      ["Эрх хэмжээ", numbered(asTextList(d.authority))],
      ["Хариуцлага", numbered(asTextList(d.responsibilities))],
    ]),
    { text: "В. Шаардлага", bold: true, fontSize: 11, margin: [0, 8, 0, 4] },
    kvTable([
      ["Боловсрол", textOrDash(d.education_level)],
      ["Туршлага", textOrDash(d.work_experience)],
      ["Ерөнхий ур чадвар", numbered(asTextList(d.general_skills))],
      ["Мэргэжлийн ур чадвар", skillValue],
      ["Сургалт", numbered(asTextList(d.required_trainings))],
      ["Гэрчилгээ", numbered(asTextList(d.required_certificates))],
    ]),
    { text: "Г. Харилцаа, удирдлага", bold: true, fontSize: 11, margin: [0, 8, 0, 4] },
    kvTable([
      ["Харилцааны хүрээ", commValue],
      ["Удирдлага", numbered(asTextList(d.supervisor_positions))],
      ["Харьяалал", numbered(asTextList(d.subordinate_positions))],
    ]),
    { text: "Д. Бусад", bold: true, fontSize: 11, margin: [0, 8, 0, 4] },
    kvTable([
      ["Холбогдох хууль", numbered(asTextList(d.relevant_laws))],
      ["Ажлын нөхцөл", textOrDash(d.job_condition)],
      ["Нөөц", textOrDash(d.resources)],
      ["Эд хөрөнгийн хариуцлага", textOrDash(d.property_liability)],
      ["Бусад", textOrDash(d.other_notes)],
    ]),
  ];
}

export async function renderPositionPreviewPdf(
  model: PositionPreviewExportModel,
): Promise<Buffer> {
  const m = POLICY_PAGE_MARGINS;
  const content: Content[] = [
    {
      text: "Журмын биелэлт · Шалгах",
      alignment: "center",
      fontSize: 9,
      margin: [0, 0, 0, 4],
    },
    {
      text: model.position.name.toUpperCase(),
      style: "title",
      alignment: "center",
      margin: [0, 0, 0, 4],
    },
    {
      text: `Албан тушаалын код: ${model.position.official_code || "—"} · BTEG ${model.position.bteg_id || "—"}`,
      alignment: "center",
      fontSize: 9,
      margin: [0, 0, 0, 2],
    },
    {
      text: `${model.organizationName || "—"} · ${model.heltes || "—"} · ${model.alba || "—"} · Экспортын огноо: ${formatExportDate()}`,
      alignment: "center",
      fontSize: 9,
      margin: [0, 0, 0, 10],
    },
    {
      table: {
        widths: ["*", "*", "*", "*"],
        body: [
          [
            {
              stack: [
                { text: "Ж-үнэлгээ", fontSize: 7, alignment: "center" },
                {
                  text: fmtScore(model.kpis.j_avg),
                  bold: true,
                  fontSize: 14,
                  alignment: "center",
                  margin: [0, 2, 0, 0],
                },
              ],
            },
            {
              stack: [
                { text: "Журмын тоо", fontSize: 7, alignment: "center" },
                {
                  text: String(model.kpis.policy_count),
                  bold: true,
                  fontSize: 14,
                  alignment: "center",
                  margin: [0, 2, 0, 0],
                },
              ],
            },
            {
              stack: [
                { text: "Заалтын тоо", fontSize: 7, alignment: "center" },
                {
                  text: String(model.kpis.clause_count),
                  bold: true,
                  fontSize: 14,
                  alignment: "center",
                  margin: [0, 2, 0, 0],
                },
              ],
            },
            {
              stack: [
                { text: "Т-үнэлгээ", fontSize: 7, alignment: "center" },
                {
                  text: fmtScore(model.kpis.t_score),
                  bold: true,
                  fontSize: 14,
                  alignment: "center",
                  margin: [0, 2, 0, 0],
                },
              ],
            },
          ],
        ],
      },
      layout: {
        hLineWidth: () => 0.7,
        vLineWidth: () => 0.7,
        hLineColor: () => "#333333",
        vLineColor: () => "#333333",
      },
      margin: [0, 0, 0, 8],
    },
    sectionTitle("1. Журмын үүрэг"),
    ...obligationsContent(model.obligations),
    sectionTitle("2. Онооны хандлага"),
    ...trendContent(model.trendPoints, model.trendSnapshot),
    sectionTitle("3. Ажлын байрны тодорхойлолт (АБТ)"),
    ...jdContent(model),
    sectionTitle("4. Т-үнэлгээ (АБТ)"),
    model.descriptionEvaluation
      ? kvTable([
          [
            "Үнэлгээний үе",
            textOrDash(model.descriptionEvaluation.evaluation_period),
          ],
          ["Оноо", fmtScore(model.descriptionEvaluation.score)],
          ["Үр дүн", textOrDash(model.descriptionEvaluation.result_text)],
          [
            "Сайжруулах арга хэмжээ",
            textOrDash(model.descriptionEvaluation.improvement_actions),
          ],
          ["Дүгнэлт", textOrDash(model.descriptionEvaluation.conclusion)],
        ])
      : { text: "Т-үнэлгээ бүртгэгдээгүй.", fontSize: 10 },
  ];

  const doc: TDocumentDefinitions = {
    pageSize: "A4",
    pageOrientation: "portrait",
    pageMargins: [
      cmToPt(m.leftCm),
      cmToPt(m.topCm),
      cmToPt(m.rightCm),
      cmToPt(m.bottomCm),
    ],
    info: {
      title: `${model.position.name} — шалгалт`,
      subject: "Ажлын байрны шалгалтын тайлан",
    },
    content,
    defaultStyle: { font: "Roboto", fontSize: 10 },
    styles: {
      title: { fontSize: 14, bold: true },
      section: { fontSize: 12, bold: true },
      tableHeader: {
        fontSize: 8,
        bold: true,
        alignment: "center",
        fillColor: "#f0f0f0",
      },
    },
  };

  return getPdfBuffer(doc);
}
