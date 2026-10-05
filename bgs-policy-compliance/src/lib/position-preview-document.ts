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
import {
  attachmentContentDisposition,
  buildWordBuffer,
  policyPageCssMargin,
  utf8Filename,
} from "@/lib/policy-document";
import type { ScoreSnapshot, ScoreTrendPoint } from "@/lib/score-trend";
import type {
  ComplianceEvaluation,
  JobDescription,
  JobDescriptionEvaluation,
  JobPosition,
  Policy,
  PolicyClause,
  ClausePositionResponsibility,
  ResponsibilityType,
} from "@/lib/types";

export type PositionPreviewObligation = {
  link: ClausePositionResponsibility;
  clause?: PolicyClause | null;
  policy?: Policy | null;
  evaluation?: ComplianceEvaluation | null;
};

export type PositionPreviewExportModel = {
  position: JobPosition;
  organizationName: string;
  heltes: string;
  alba: string;
  kpis: {
    j_avg: number | null;
    policy_count: number;
    clause_count: number;
    t_score: number | null;
  };
  obligations: PositionPreviewObligation[];
  trendPoints: ScoreTrendPoint[];
  trendSnapshot: ScoreSnapshot;
  description: JobDescription | null;
  descriptionEvaluation: JobDescriptionEvaluation | null;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function cell(v: string | null | undefined): string {
  const t = (v ?? "").trim();
  return escapeHtml(t || "—");
}

function numberedHtml(items: string[]): string {
  if (!items.length) return "—";
  return `<ol style="margin:0;padding-left:18pt;">${items
    .map((i) => `<li style="margin:0 0 3pt;">${escapeHtml(i)}</li>`)
    .join("")}</ol>`;
}

type ObligationGroup = {
  label: string;
  code: string | null;
  clauses: Array<{
    ref: string;
    text: string;
    rows: PositionPreviewObligation[];
  }>;
};

function groupObligations(
  rows: PositionPreviewObligation[],
): ObligationGroup[] {
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
    const policyLabel = r.policy?.name?.trim() || "Ангилагдаагүй журам";
    const code = r.policy?.reference_code ?? null;
    if (!byPolicy.has(policyId)) {
      byPolicy.set(policyId, {
        label: policyLabel,
        code,
        byClause: new Map(),
      });
    }
    const pg = byPolicy.get(policyId)!;
    const clauseId = r.clause?.id ?? "__none__";
    const ref = r.clause?.reference_number?.trim() || "—";
    const text = r.clause?.text?.trim() || "Зүйлгүй";
    if (!pg.byClause.has(clauseId)) {
      pg.byClause.set(clauseId, { ref, text, rows: [] });
    }
    pg.byClause.get(clauseId)!.rows.push(r);
  }

  const groups: ObligationGroup[] = [];
  for (const [, pg] of byPolicy) {
    const clauses = [...pg.byClause.values()].sort((a, b) =>
      a.ref.localeCompare(b.ref, "mn", { numeric: true }),
    );
    for (const c of clauses) {
      c.rows.sort((a, b) =>
        a.link.responsibility_type.localeCompare(b.link.responsibility_type),
      );
    }
    groups.push({
      label: pg.label,
      code: pg.code,
      clauses,
    });
  }
  return groups.sort((a, b) => a.label.localeCompare(b.label, "mn"));
}

function renderObligationsHtml(rows: PositionPreviewObligation[]): string {
  if (!rows.length) {
    return `<p style="font-size:11pt;margin:0;">Журмын үүрэг бүртгэгдээгүй.</p>`;
  }
  const groups = groupObligations(rows);
  const parts: string[] = [];
  for (const g of groups) {
    const code = g.code ? ` (${escapeHtml(g.code)})` : "";
    parts.push(
      `<h3 style="font-size:12pt;margin:12pt 0 6pt;">${escapeHtml(g.label)}${code}</h3>`,
    );
    for (const c of g.clauses) {
      parts.push(
        `<p style="font-size:11pt;margin:6pt 0 4pt;text-align:justify;"><strong>${escapeHtml(c.ref)}.</strong> ${escapeHtml(c.text)}</p>`,
      );
      parts.push(
        `<table style="width:100%;border-collapse:collapse;margin:0 0 8pt;">
  <thead>
    <tr>
      <th style="padding:4pt 6pt;border:1px solid #333;background:#f3f3f3;font-size:9pt;">Үүрэг</th>
      <th style="padding:4pt 6pt;border:1px solid #333;background:#f3f3f3;font-size:9pt;width:60pt;">Оноо</th>
      <th style="padding:4pt 6pt;border:1px solid #333;background:#f3f3f3;font-size:9pt;width:90pt;">Төлөв</th>
      <th style="padding:4pt 6pt;border:1px solid #333;background:#f3f3f3;font-size:9pt;">Үе / тэмдэглэл</th>
    </tr>
  </thead>
  <tbody>
  ${c.rows
    .map((r) => {
      const type = RESPONSIBILITY_SHORT[r.link.responsibility_type];
      const score = fmtScore(r.evaluation?.score);
      const status = r.evaluation?.status
        ? COMPLIANCE_STATUS_LABELS[r.evaluation.status]
        : "—";
      const note = [
        r.evaluation?.evaluation_period,
        r.evaluation?.comment,
      ]
        .filter(Boolean)
        .join(" · ");
      return `<tr>
      <td style="padding:4pt 6pt;border:1px solid #666;font-size:10pt;">${escapeHtml(type)}</td>
      <td style="padding:4pt 6pt;border:1px solid #666;font-size:10pt;text-align:center;">${escapeHtml(score)}</td>
      <td style="padding:4pt 6pt;border:1px solid #666;font-size:10pt;text-align:center;">${escapeHtml(status)}</td>
      <td style="padding:4pt 6pt;border:1px solid #666;font-size:10pt;">${cell(note)}</td>
    </tr>`;
    })
    .join("\n")}
  </tbody>
</table>`,
      );
    }
  }
  return parts.join("\n");
}

function renderTrendHtml(
  points: ScoreTrendPoint[],
  snapshot: ScoreSnapshot,
): string {
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

  const summary = `<table style="width:100%;border-collapse:collapse;margin:0 0 10pt;">
  <tr>
  ${chips
    .map(
      ([label, value]) =>
        `<td style="padding:6pt;border:1px solid #666;text-align:center;width:${100 / chips.length}%;">
      <div style="font-size:8pt;text-transform:uppercase;letter-spacing:0.04em;">${escapeHtml(label)}</div>
      <div style="font-size:14pt;font-weight:bold;margin-top:2pt;">${escapeHtml(value)}</div>
    </td>`,
    )
    .join("")}
  </tr>
</table>`;

  if (!points.length) {
    return `${summary}<p style="font-size:11pt;margin:0;">Үнэлгээний хандлагын өгөгдөл байхгүй.</p>`;
  }

  const rows = points
    .map(
      (p) => `<tr>
  <td style="padding:4pt 6pt;border:1px solid #666;font-size:10pt;text-align:center;">${escapeHtml(p.period)}</td>
  <td style="padding:4pt 6pt;border:1px solid #666;font-size:10pt;text-align:center;">${escapeHtml(fmtScore(p.j_avg))}</td>
  <td style="padding:4pt 6pt;border:1px solid #666;font-size:10pt;text-align:center;">${escapeHtml(fmtScore(p.implementation))}</td>
  <td style="padding:4pt 6pt;border:1px solid #666;font-size:10pt;text-align:center;">${escapeHtml(fmtScore(p.monitoring))}</td>
  <td style="padding:4pt 6pt;border:1px solid #666;font-size:10pt;text-align:center;">${escapeHtml(fmtScore(p.verification))}</td>
  <td style="padding:4pt 6pt;border:1px solid #666;font-size:10pt;text-align:center;">${escapeHtml(fmtScore(p.deployment))}</td>
  <td style="padding:4pt 6pt;border:1px solid #666;font-size:10pt;text-align:center;">${escapeHtml(fmtScore(p.t_score))}</td>
</tr>`,
    )
    .join("\n");

  return `${summary}
<p style="font-size:9pt;margin:0 0 6pt;color:#333;">Үе бүрийн cumulative дундаж (Шалгах дэлгэц дээрх онооны хандлага).</p>
<table style="width:100%;border-collapse:collapse;margin:0 0 8pt;">
  <thead>
    <tr>
      <th style="padding:4pt 6pt;border:1px solid #333;background:#f3f3f3;font-size:9pt;">Үе</th>
      <th style="padding:4pt 6pt;border:1px solid #333;background:#f3f3f3;font-size:9pt;">Ж</th>
      <th style="padding:4pt 6pt;border:1px solid #333;background:#f3f3f3;font-size:9pt;">Гүйцэтгэх</th>
      <th style="padding:4pt 6pt;border:1px solid #333;background:#f3f3f3;font-size:9pt;">Хянах</th>
      <th style="padding:4pt 6pt;border:1px solid #333;background:#f3f3f3;font-size:9pt;">Баталгаажуулах</th>
      <th style="padding:4pt 6pt;border:1px solid #333;background:#f3f3f3;font-size:9pt;">Нэвтрүүлэх</th>
      <th style="padding:4pt 6pt;border:1px solid #333;background:#f3f3f3;font-size:9pt;">Т</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>`;
}

function kvRow(label: string, valueHtml: string): string {
  return `<tr>
  <td style="width:34%;padding:5pt 6pt;border:1px solid #333;background:#f7f7f7;font-size:10pt;font-weight:bold;vertical-align:top;">${escapeHtml(label)}</td>
  <td style="padding:5pt 6pt;border:1px solid #333;font-size:10pt;vertical-align:top;">${valueHtml}</td>
</tr>`;
}

function renderJobDescriptionHtml(d: JobDescription | null): string {
  if (!d) {
    return `<p style="font-size:11pt;margin:0;">Ажлын байрны тодорхойлолт байхгүй.</p>`;
  }
  const heading = documentHeading(d);
  const authority = asTextList(d.authority);
  const responsibilities = asTextList(d.responsibilities);
  const duties = asTextList(d.duties);
  const laws = asTextList(d.relevant_laws);
  const generalSkills = asTextList(d.general_skills);
  const trainings = asTextList(d.required_trainings);
  const certificates = asTextList(d.required_certificates);
  const supervisors = asTextList(d.supervisor_positions);
  const subordinates = asTextList(d.subordinate_positions);
  const skillCats = asSkillCategories(d.professional_skills);
  const comm = asCommunication(d.communication_scope);

  const skillCatHtml = skillCats.length
    ? skillCats
        .map(
          (c) =>
            `<p style="margin:4pt 0 2pt;font-weight:bold;">${escapeHtml(c.title)}</p>${numberedHtml(c.items)}`,
        )
        .join("")
    : numberedHtml(asTextList(d.professional_skills));

  const commHtml =
    comm.internal.trim() || comm.external.trim()
      ? `<p style="margin:0 0 2pt;"><strong>Дотоод:</strong> ${cell(comm.internal)}</p>
         <p style="margin:4pt 0 0;"><strong>Гадаад:</strong> ${cell(comm.external)}</p>`
      : "—";

  return `
<p style="font-size:12pt;text-align:center;font-weight:bold;margin:0 0 2pt;text-transform:uppercase;">${escapeHtml(heading)}</p>
<p style="font-size:10pt;text-align:center;margin:0 0 10pt;">Албан тушаалын тодорхойлолт</p>
<table style="width:100%;border-collapse:collapse;margin:0 0 8pt;">
  ${kvRow("Байгууллага", cell(d.company_name || JD_DEFAULT_COMPANY))}
  ${kvRow("Байршил", cell(d.location || JD_DEFAULT_LOCATION))}
  ${kvRow("Нэгж", cell(d.unit_name))}
  ${kvRow("Албан тушаалын код", cell(d.position_code))}
  ${kvRow("ҮАМА код", cell(d.a_code))}
</table>
<h3 style="font-size:12pt;margin:12pt 0 6pt;">А. Нийтлэг үндэслэл</h3>
<table style="width:100%;border-collapse:collapse;margin:0 0 8pt;">
  ${kvRow("Зорилго", cell(d.purpose))}
  ${kvRow("Ажлын цаг", cell(d.schedule))}
  ${kvRow("Өдрийн цаг", cell(d.daily_hours))}
  ${kvRow("Амралт", cell(d.break_time))}
  ${kvRow("Албан тушаал", cell(d.position_note))}
</table>
<h3 style="font-size:12pt;margin:12pt 0 6pt;">Б. Үүрэг, эрх хэмжээ</h3>
<table style="width:100%;border-collapse:collapse;margin:0 0 8pt;">
  ${kvRow("Үндсэн үүрэг", numberedHtml(duties))}
  ${kvRow("Эрх хэмжээ", numberedHtml(authority))}
  ${kvRow("Хариуцлага", numberedHtml(responsibilities))}
</table>
<h3 style="font-size:12pt;margin:12pt 0 6pt;">В. Шаардлага</h3>
<table style="width:100%;border-collapse:collapse;margin:0 0 8pt;">
  ${kvRow("Боловсрол", cell(d.education_level))}
  ${kvRow("Туршлага", cell(d.work_experience))}
  ${kvRow("Ерөнхий ур чадвар", numberedHtml(generalSkills))}
  ${kvRow("Мэргэжлийн ур чадвар", skillCatHtml)}
  ${kvRow("Сургалт", numberedHtml(trainings))}
  ${kvRow("Гэрчилгээ", numberedHtml(certificates))}
</table>
<h3 style="font-size:12pt;margin:12pt 0 6pt;">Г. Харилцаа, удирдлага</h3>
<table style="width:100%;border-collapse:collapse;margin:0 0 8pt;">
  ${kvRow("Харилцааны хүрээ", commHtml)}
  ${kvRow("Удирдлага", numberedHtml(supervisors))}
  ${kvRow("Харьяалал", numberedHtml(subordinates))}
</table>
<h3 style="font-size:12pt;margin:12pt 0 6pt;">Д. Бусад</h3>
<table style="width:100%;border-collapse:collapse;margin:0 0 8pt;">
  ${kvRow("Холбогдох хууль", numberedHtml(laws))}
  ${kvRow("Ажлын нөхцөл", cell(d.job_condition))}
  ${kvRow("Нөөц", cell(d.resources))}
  ${kvRow("Эд хөрөнгийн хариуцлага", cell(d.property_liability))}
  ${kvRow("Бусад", cell(d.other_notes))}
</table>`;
}

function renderTEvalHtml(e: JobDescriptionEvaluation | null): string {
  if (!e) {
    return `<p style="font-size:11pt;margin:0;">Т-үнэлгээ бүртгэгдээгүй.</p>`;
  }
  return `<table style="width:100%;border-collapse:collapse;">
  ${kvRow("Үнэлгээний үе", cell(e.evaluation_period))}
  ${kvRow("Оноо", escapeHtml(fmtScore(e.score)))}
  ${kvRow("Үр дүн", cell(e.result_text))}
  ${kvRow("Сайжруулах арга хэмжээ", cell(e.improvement_actions))}
  ${kvRow("Дүгнэлт", cell(e.conclusion))}
</table>`;
}

/** Formal Word/HTML of the Шалгах preview screen for one position. */
export function renderPositionPreviewHtml(
  model: PositionPreviewExportModel,
): string {
  const pageMargin = policyPageCssMargin();
  const title = model.position.name;
  const code = model.position.official_code || "—";
  const bteg = model.position.bteg_id || "—";
  const exportedAt = formatExportDate();

  const kpiHtml = `<table style="width:100%;border-collapse:collapse;margin:0 0 14pt;">
  <tr>
    <td style="padding:8pt;border:1px solid #333;text-align:center;width:25%;">
      <div style="font-size:8pt;text-transform:uppercase;">Ж-үнэлгээ</div>
      <div style="font-size:16pt;font-weight:bold;margin-top:2pt;">${escapeHtml(fmtScore(model.kpis.j_avg))}</div>
    </td>
    <td style="padding:8pt;border:1px solid #333;text-align:center;width:25%;">
      <div style="font-size:8pt;text-transform:uppercase;">Журмын тоо</div>
      <div style="font-size:16pt;font-weight:bold;margin-top:2pt;">${model.kpis.policy_count}</div>
    </td>
    <td style="padding:8pt;border:1px solid #333;text-align:center;width:25%;">
      <div style="font-size:8pt;text-transform:uppercase;">Заалтын тоо</div>
      <div style="font-size:16pt;font-weight:bold;margin-top:2pt;">${model.kpis.clause_count}</div>
    </td>
    <td style="padding:8pt;border:1px solid #333;text-align:center;width:25%;">
      <div style="font-size:8pt;text-transform:uppercase;">Т-үнэлгээ</div>
      <div style="font-size:16pt;font-weight:bold;margin-top:2pt;">${escapeHtml(fmtScore(model.kpis.t_score))}</div>
    </td>
  </tr>
</table>`;

  return `<!DOCTYPE html>
<html lang="mn">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)} — шалгалт</title>
<style>
  @page { size: A4; margin: ${pageMargin}; }
  html, body {
    margin: 0;
    padding: 0;
    color: #000;
    background: #fff;
    font-family: 'Times New Roman', Times, serif;
  }
  @media print { html, body { margin: 0 !important; } }
  h2 {
    font-size: 13pt;
    margin: 18pt 0 8pt;
    padding-bottom: 3pt;
    border-bottom: 1px solid #000;
    text-transform: uppercase;
  }
</style>
<!--[if gte mso 9]><xml>
<w:WordDocument xmlns:w="urn:schemas-microsoft-com:office:word">
  <w:View>Print</w:View>
  <w:Zoom>100</w:Zoom>
</w:WordDocument>
</xml><![endif]-->
</head>
<body>
  <p style="font-size:10pt;text-align:center;margin:0 0 4pt;">Журмын биелэлт · Шалгах</p>
  <h1 style="font-size:16pt;text-align:center;margin:0 0 6pt;text-transform:uppercase;">${escapeHtml(title)}</h1>
  <p style="font-size:10pt;text-align:center;margin:0 0 4pt;">
    Албан тушаалын код: ${escapeHtml(code)} · BTEG ${escapeHtml(bteg)}
  </p>
  <p style="font-size:10pt;text-align:center;margin:0 0 12pt;">
    ${escapeHtml(model.organizationName || "—")} · ${escapeHtml(model.heltes || "—")} · ${escapeHtml(model.alba || "—")}
    · Экспортын огноо: ${exportedAt}
  </p>

  ${kpiHtml}

  <h2>1. Журмын үүрэг</h2>
  ${renderObligationsHtml(model.obligations)}

  <h2>2. Онооны хандлага</h2>
  ${renderTrendHtml(model.trendPoints, model.trendSnapshot)}

  <h2>3. Ажлын байрны тодорхойлолт (АБТ)</h2>
  ${renderJobDescriptionHtml(model.description)}

  <h2>4. Т-үнэлгээ (АБТ)</h2>
  ${renderTEvalHtml(model.descriptionEvaluation)}
</body>
</html>`;
}

export function buildPositionPreviewWordBuffer(
  model: PositionPreviewExportModel,
): Buffer {
  return buildWordBuffer(renderPositionPreviewHtml(model));
}

export function positionPreviewExportFilename(
  model: PositionPreviewExportModel,
): string {
  return utf8Filename(`${model.position.name} — шалгалт`.slice(0, 80), "doc");
}

export function positionPreviewAttachmentDisposition(
  model: PositionPreviewExportModel,
): string {
  return attachmentContentDisposition(positionPreviewExportFilename(model));
}
