import type { PositionReviewRow } from "@/lib/org-assign";
import {
  attachmentContentDisposition,
  buildWordBuffer,
  policyPageCssMargin,
  utf8Filename,
} from "@/lib/policy-document";

export type PositionReviewScope = {
  organization?: string;
  heltesId?: string;
  albaId?: string;
  q?: string;
};

export type PositionReviewTreeAlba = {
  key: string;
  label: string;
  items: PositionReviewRow[];
};

export type PositionReviewTreeHeltes = {
  key: string;
  label: string;
  albas: PositionReviewTreeAlba[];
};

export type PositionReviewTreeOrg = {
  key: string;
  label: string;
  heltes: PositionReviewTreeHeltes[];
};

export function filterPositionReviewRows(
  rows: PositionReviewRow[],
  scope: PositionReviewScope,
): PositionReviewRow[] {
  let out = rows;
  if (scope.organization) {
    const org = scope.organization;
    out = out.filter((r) => {
      const key = r.organization_name.trim() || "__none__";
      return key === org;
    });
  }
  if (scope.heltesId) {
    out = out.filter((r) => r.heltesId === scope.heltesId);
  }
  if (scope.albaId) {
    out = out.filter((r) => r.albaId === scope.albaId);
  }
  if (scope.q?.trim()) {
    const s = scope.q.trim().toLowerCase();
    out = out.filter(
      (r) =>
        r.name.toLowerCase().includes(s) ||
        (r.official_code ?? "").toLowerCase().includes(s) ||
        (r.bteg_id ?? "").includes(s),
    );
  }
  return out;
}

export function scopeTitle(scope: PositionReviewScope): string {
  const parts = ["Ажлын байрны шалгалтын жагсаалт"];
  if (scope.organization && scope.organization !== "__none__") {
    parts.push(scope.organization);
  } else if (scope.organization === "__none__") {
    parts.push("Ангилагдаагүй");
  }
  if (scope.heltesId) parts.push(`хэлтэс: ${scope.heltesId}`);
  if (scope.albaId) parts.push(`алба: ${scope.albaId}`);
  if (scope.q?.trim()) parts.push(`хайлт: ${scope.q.trim()}`);
  return parts.join(" · ");
}

export function scopeSubtitle(scope: PositionReviewScope): string {
  const parts: string[] = [];
  if (scope.organization && scope.organization !== "__none__") {
    parts.push(`Байгууллага: ${scope.organization}`);
  } else if (scope.organization === "__none__") {
    parts.push("Байгууллага: Ангилагдаагүй");
  }
  if (scope.heltesId) parts.push(`Хэлтэс: ${scope.heltesId}`);
  if (scope.albaId) parts.push(`Алба: ${scope.albaId}`);
  if (scope.q?.trim()) parts.push(`Хайлт: ${scope.q.trim()}`);
  return parts.length ? parts.join(" · ") : "Хүрээ: бүх ажлын байр";
}

/** Same hierarchy as Шалгах UI table (байгууллага → хэлтэс → алба). */
export function buildPositionReviewTree(
  rows: PositionReviewRow[],
): PositionReviewTreeOrg[] {
  const orgMap = new Map<
    string,
    Map<string, Map<string, PositionReviewRow[]>>
  >();

  for (const row of rows) {
    const orgKey = row.organization_name.trim() || "__none__";
    const hKey = row.heltesId;
    const aKey = row.albaId;
    if (!orgMap.has(orgKey)) orgMap.set(orgKey, new Map());
    const hMap = orgMap.get(orgKey)!;
    if (!hMap.has(hKey)) hMap.set(hKey, new Map());
    const aMap = hMap.get(hKey)!;
    if (!aMap.has(aKey)) aMap.set(aKey, []);
    aMap.get(aKey)!.push(row);
  }

  const orgs: PositionReviewTreeOrg[] = [];
  for (const [orgKey, hMap] of orgMap) {
    const heltes: PositionReviewTreeHeltes[] = [];
    for (const [hKey, aMap] of hMap) {
      const albas: PositionReviewTreeAlba[] = [];
      for (const [aKey, items] of aMap) {
        albas.push({
          key: `${orgKey}::${hKey}::${aKey}`,
          label: items[0]?.alba || aKey,
          items: items.sort((a, b) => a.name.localeCompare(b.name, "mn")),
        });
      }
      albas.sort((a, b) => a.label.localeCompare(b.label, "mn"));
      heltes.push({
        key: `${orgKey}::${hKey}`,
        label: albas[0]?.items[0]?.heltes || hKey,
        albas,
      });
    }
    heltes.sort((a, b) => a.label.localeCompare(b.label, "mn"));
    orgs.push({
      key: orgKey,
      label: orgKey === "__none__" ? "Ангилагдаагүй байгууллага" : orgKey,
      heltes,
    });
  }
  orgs.sort((a, b) => {
    if (a.key === "__none__") return 1;
    if (b.key === "__none__") return -1;
    return a.label.localeCompare(b.label, "mn");
  });
  return orgs;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function fmtReviewScore(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return String(Math.round(v));
}

function formatExportDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const TH =
  "padding:5pt 6pt;border:1px solid #333;background:#f3f3f3;font-size:9pt;text-align:center;font-weight:bold;";
const TD =
  "padding:4pt 6pt;border:1px solid #666;font-size:10pt;vertical-align:top;";

function positionRowHtml(r: PositionReviewRow, index: number): string {
  return `<tr>
  <td style="${TD}text-align:center;width:28pt;">${index}</td>
  <td style="${TD}">${escapeHtml(r.name)}</td>
  <td style="${TD}font-family:Consolas,'Courier New',monospace;text-align:center;">${escapeHtml(r.official_code || "—")}</td>
  <td style="${TD}text-align:center;">${fmtReviewScore(r.policy_avg_score)}</td>
  <td style="${TD}text-align:center;">${r.policy_count}</td>
  <td style="${TD}text-align:center;">${r.clause_count}</td>
  <td style="${TD}text-align:center;">${r.has_job_description ? "Тийм" : "Үгүй"}</td>
  <td style="${TD}text-align:center;">${fmtReviewScore(r.description_score)}</td>
</tr>`;
}

function tableHeaderHtml(): string {
  return `<thead>
  <tr>
    <th style="${TH}">№</th>
    <th style="${TH}">Ажлын байр</th>
    <th style="${TH}">Албан тушаалын код</th>
    <th style="${TH}">Ж-үнэлгээ</th>
    <th style="${TH}">Журмын тоо</th>
    <th style="${TH}">Заалтын тоо</th>
    <th style="${TH}">Тодорхойлолт</th>
    <th style="${TH}">Т-үнэлгээ</th>
  </tr>
</thead>`;
}

/**
 * Formal Word/HTML export of the Шалгах list screen:
 * filtered rows, hierarchical org → heltes → alba, same columns as the UI table.
 */
export function renderPositionReviewHtml(
  rows: PositionReviewRow[],
  scope: PositionReviewScope,
): string {
  const tree = buildPositionReviewTree(rows);
  const pageMargin = policyPageCssMargin();
  const exportedAt = formatExportDate();
  const subtitle = escapeHtml(scopeSubtitle(scope));

  let counter = 0;
  const sections: string[] = [];

  for (const org of tree) {
    sections.push(
      `<h2 style="font-family:'Times New Roman',Times,serif;font-size:13pt;margin:16pt 0 6pt;border-bottom:1px solid #000;padding-bottom:3pt;">${escapeHtml(org.label)}</h2>`,
    );
    for (const heltes of org.heltes) {
      sections.push(
        `<h3 style="font-family:'Times New Roman',Times,serif;font-size:12pt;margin:10pt 0 4pt;">${escapeHtml(heltes.label)}</h3>`,
      );
      for (const alba of heltes.albas) {
        sections.push(
          `<h4 style="font-family:'Times New Roman',Times,serif;font-size:11pt;margin:8pt 0 4pt;font-weight:bold;">${escapeHtml(alba.label)} <span style="font-weight:normal;font-size:10pt;">(${alba.items.length})</span></h4>`,
        );
        const body = alba.items
          .map((r) => {
            counter += 1;
            return positionRowHtml(r, counter);
          })
          .join("\n");
        sections.push(
          `<table style="width:100%;border-collapse:collapse;margin:0 0 10pt;">
  ${tableHeaderHtml()}
  <tbody>
  ${body}
  </tbody>
</table>`,
        );
      }
    }
  }

  if (!rows.length) {
    sections.push(
      `<p style="font-family:'Times New Roman',Times,serif;font-size:11pt;text-align:center;margin:24pt 0;">Сонгосон хүрээнд ажлын байр олдсонгүй.</p>`,
    );
  }

  return `<!DOCTYPE html>
<html lang="mn">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(scopeTitle(scope))}</title>
<style>
  @page { size: A4 landscape; margin: ${pageMargin}; }
  html, body {
    margin: 0;
    padding: 0;
    color: #000;
    background: #fff;
    font-family: 'Times New Roman', Times, serif;
  }
  @media print {
    html, body { margin: 0 !important; }
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
  <h1 style="font-size:16pt;text-align:center;margin:0 0 8pt;text-transform:uppercase;letter-spacing:0.02em;">Ажлын байрны шалгалтын жагсаалт</h1>
  <p style="font-size:10pt;text-align:center;margin:0 0 4pt;">${subtitle}</p>
  <p style="font-size:10pt;text-align:center;margin:0 0 14pt;">Нийт ${rows.length} ажлын байр · Экспортын огноо: ${exportedAt}</p>
  ${sections.join("\n")}
</body>
</html>`;
}

export function buildPositionReviewWordBuffer(
  rows: PositionReviewRow[],
  scope: PositionReviewScope,
): Buffer {
  return buildWordBuffer(renderPositionReviewHtml(rows, scope));
}

export function positionReviewExportFilename(scope: PositionReviewScope): string {
  const base = scopeTitle(scope).slice(0, 60);
  return utf8Filename(base, "doc");
}

export function positionReviewAttachmentDisposition(
  scope: PositionReviewScope,
): string {
  const name = positionReviewExportFilename(scope);
  return attachmentContentDisposition(name);
}
