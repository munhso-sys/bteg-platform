/**
 * Pure АБТ parsers for Загвар.docx-style label/value tables (browser-safe).
 */

export type ParsedJobDescriptionFields = {
  title?: string | null;
  a_code?: string | null;
  position_code?: string | null;
  company_name?: string | null;
  location?: string | null;
  unit_name?: string | null;
  job_condition?: string | null;
  purpose?: string | null;
  schedule?: string | null;
  daily_hours?: string | null;
  break_time?: string | null;
  position_note?: string | null;
  duties?: string[];
  education_level?: string | null;
  work_experience?: string | null;
  general_skills?: string[];
  professional_skills?: string[] | Array<{ title: string; items: string[] }>;
  authority?: string | string[] | null;
  responsibilities?: string | string[] | null;
  relevant_laws?: string[];
  resources?: string | null;
  required_trainings?: string[];
  required_certificates?: string[];
  property_liability?: string | null;
  other_notes?: string | null;
  communication_scope?: unknown;
  supervisor_positions?: string[];
  subordinate_positions?: string[];
  markdown_body?: string | null;
};

type ScalarField =
  | "title"
  | "a_code"
  | "position_code"
  | "company_name"
  | "location"
  | "unit_name"
  | "job_condition"
  | "purpose"
  | "schedule"
  | "daily_hours"
  | "break_time"
  | "position_note"
  | "education_level"
  | "work_experience"
  | "resources"
  | "property_liability"
  | "other_notes";

type ListField =
  | "duties"
  | "general_skills"
  | "authority"
  | "responsibilities"
  | "relevant_laws"
  | "required_trainings"
  | "required_certificates"
  | "supervisor_positions"
  | "subordinate_positions";

type LabelKind =
  | { kind: "scalar"; field: ScalarField }
  | { kind: "list"; field: ListField; splitComma?: boolean }
  | { kind: "communication" }
  | { kind: "professional" }
  | { kind: "certificates_header" }
  | { kind: "skip" };

/** Longer / more specific labels first. */
const LABEL_RULES: Array<{ re: RegExp; map: LabelKind }> = [
  {
    re: /^компанийн\s+нэр$/i,
    map: { kind: "scalar", field: "company_name" },
  },
  { re: /^байршил$/i, map: { kind: "scalar", field: "location" } },
  {
    re: /^нэгжийн\s+нэр$/i,
    map: { kind: "scalar", field: "unit_name" },
  },
  {
    re: /^албан\s+тушаалын\s+нэр$/i,
    map: { kind: "scalar", field: "title" },
  },
  {
    re: /^үндэсний\s+ажил\s+мэргэжлийн\s+ангиллын\s+код$/i,
    map: { kind: "scalar", field: "a_code" },
  },
  {
    re: /^албан\s+тушаалын\s+код$/i,
    map: { kind: "scalar", field: "position_code" },
  },
  {
    re: /^шууд\s+харьяалагдах\s+албан\s+тушаал$/i,
    map: { kind: "list", field: "supervisor_positions", splitComma: true },
  },
  {
    re: /^шууд\s+харьяалах\s+албан\s+тушаал$/i,
    map: { kind: "list", field: "subordinate_positions", splitComma: true },
  },
  {
    re: /^(?:хөдөлмөрийн|ажлын)\s+нөхцөл$/i,
    map: { kind: "scalar", field: "job_condition" },
  },
  {
    re: /^харилцах\s+хүрээ$|^харилцааны\s+хамрах\s+хүрээ$/i,
    map: { kind: "communication" },
  },
  {
    re: /^(?:албан\s+тушаалын\s+)?зорилго(?:\s+ба\s+зорилт)?$/i,
    map: { kind: "scalar", field: "purpose" },
  },
  {
    re: /^ажлын\s+хуваарийн\s+талаарх\s+мэдээлэл$|^(?:ажлын\s+)?хуваарь$/i,
    map: { kind: "scalar", field: "schedule" },
  },
  {
    re: /^ажлын\s+өдрийн\s+цаг$|^(?:өдрийн|ажлын)\s+цаг(?:\s+хугацаа)?$/i,
    map: { kind: "scalar", field: "daily_hours" },
  },
  {
    re: /^өдрийн\s+цайны\s+цаг$|^завсарлага(?:\s+цаг)?$/i,
    map: { kind: "scalar", field: "break_time" },
  },
  {
    re: /^албан\s+тушаал$/i,
    map: { kind: "scalar", field: "position_note" },
  },
  {
    re: /^боловсрол(?:ын\s+(?:түвшин|шаардлага))?$/i,
    map: { kind: "scalar", field: "education_level" },
  },
  {
    re: /^(?:ажлын\s+)?туршлага$/i,
    map: { kind: "scalar", field: "work_experience" },
  },
  {
    re: /^ерөнхий\s+(?:ур\s+)?чадвар(?:ууд)?$/i,
    map: { kind: "list", field: "general_skills" },
  },
  {
    re: /^мэргэжлийн\s+(?:ур\s+)?чадвар(?:ууд)?$/i,
    map: { kind: "professional" },
  },
  {
    re: /^хамрагдсан\s+байвал\s+зохих\s+сургалтууд$/i,
    map: { kind: "list", field: "required_trainings" },
  },
  {
    re: /сертификат|зөвшөөрөл|лиценз/i,
    map: { kind: "certificates_header" },
  },
  {
    re: /^албан\s+тушаалын\s+нөөц\s+хэрэгсэл|^нөөц\s+хэрэгсэл|^(?:нөөц|хэрэгсэл)/i,
    map: { kind: "scalar", field: "resources" },
  },
  {
    re: /^албан\s+тушаалын\s+эрх\s+мэдэл$|^эрх\s+мэдэл$/i,
    map: { kind: "list", field: "authority" },
  },
  {
    re: /^албан\s+тушаалын\s+хариуцлага$|^хариуцлага$/i,
    map: { kind: "list", field: "responsibilities" },
  },
  {
    re: /^эд\s+хөрөнгийн\s+хариуцлага$/i,
    map: { kind: "scalar", field: "property_liability" },
  },
  {
    re: /^бусад$/i,
    map: { kind: "scalar", field: "other_notes" },
  },
  {
    re: /мэдсэн\s+байх\s+гол\s+хууль|холбогдох\s+хууль|хууль\s+тогтоомж.*дүрэм\s+журам/i,
    map: { kind: "list", field: "relevant_laws" },
  },
  {
    re: /гүйцэтгэх\s+(?:ажил\s+)?үүрэг|үндсэн\s+үүрэг|^үүрэг$/i,
    map: { kind: "list", field: "duties" },
  },
  // Legacy short labels
  { re: /^гарчиг$|^title$/i, map: { kind: "scalar", field: "title" } },
  {
    re: /^код$|^a[_\s-]?code$/i,
    map: { kind: "scalar", field: "a_code" },
  },
  { re: /^зорилго$/i, map: { kind: "scalar", field: "purpose" } },
  {
    re: /^ерөнхий\s+шаардлага$|^нэмэлт\s+шаардлага$|^[abcdeавс]\.?\s+/i,
    map: { kind: "skip" },
  },
];

export function cleanJobDescriptionText(value: string) {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function stripHtml(html: string) {
  return cleanJobDescriptionText(
    html
      .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<\/tr>/gi, "\n")
      .replace(/<\/h[1-6]>/gi, "\n")
      .replace(/<li[^>]*>/gi, "• ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/\s+\n/g, "\n")
      .replace(/[ \t]{2,}/g, " "),
  );
}

function stripHtmlInline(html: string) {
  return stripHtml(html).replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeLabel(raw: string) {
  return raw
    .replace(/^#{1,6}\s*/, "")
    .replace(/^\*{1,2}|\*{1,2}$/g, "")
    .replace(/^[•\-–—]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/[:：]\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchLabel(raw: string): LabelKind | null {
  const label = normalizeLabel(raw);
  if (!label) return null;
  // Long certificate/law labels still match via keyword rules.
  for (const rule of LABEL_RULES) {
    if (rule.re.test(label)) return rule.map;
  }
  return null;
}

function isSectionBanner(line: string) {
  return /^[abcdeавс]\.?\s+/i.test(normalizeLabel(line));
}

function linesToList(body: string, splitComma = false): string[] {
  const chunks = body
    .split(/\n+/)
    .map((line) =>
      line
        .replace(/^[•\-–—*]\s*/, "")
        .replace(/^\d+[.)]\s*/, "")
        .trim(),
    )
    .filter(Boolean);
  if (!splitComma) return chunks;
  return chunks
    .flatMap((line) => line.split(/[,;]/).map((p) => p.trim()))
    .filter(Boolean);
}

function applyCommunication(
  fields: ParsedJobDescriptionFields,
  body: string,
) {
  const text = body.trim();
  if (!text) return;
  const prev =
    fields.communication_scope &&
    typeof fields.communication_scope === "object" &&
    !Array.isArray(fields.communication_scope)
      ? (fields.communication_scope as {
          company_internal?: string;
          external?: string;
        })
      : {};

  const internalMatch = text.match(
    /компани\s*дотор\s*[:：]?\s*([\s\S]*?)(?=(?:[-–—]\s*)?гадна\s*[:：]|$)/i,
  );
  const externalMatch = text.match(
    /(?:^|[\n])\s*[-–—]?\s*гадна\s*[:：]?\s*([\s\S]*)$/i,
  );

  let internal = (internalMatch?.[1] ?? "").replace(/^[-–—]\s*/, "").trim();
  let external = (externalMatch?.[1] ?? "").replace(/^[-–—]\s*/, "").trim();

  if (!internalMatch && !externalMatch) {
    if (/^[-–—]?\s*гадна/i.test(text)) {
      external = text.replace(/^[-–—]?\s*гадна\s*[:：]?\s*/i, "").trim();
    } else if (/^[-–—]?\s*компани\s*дотор/i.test(text)) {
      internal = text
        .replace(/^[-–—]?\s*компани\s*дотор\s*[:：]?\s*/i, "")
        .trim();
    } else {
      internal = text.replace(/^[-–—]\s*/, "").trim();
    }
  }

  fields.communication_scope = {
    company_internal: internal || prev.company_internal || "",
    external: external || prev.external || "",
  };
}

function coalesceSkillCategories(
  cats: Array<{ title: string; items: string[] }>,
) {
  const out: Array<{ title: string; items: string[] }> = [];
  for (const cat of cats) {
    const title = cat.title.replace(/\s+/g, " ").trim();
    const items = cat.items.map((i) => i.trim()).filter(Boolean);
    const prev = out[out.length - 1];
    if (prev && prev.items.length === 0 && title && items.length) {
      prev.title = `${prev.title} ${title}`.replace(/\s+/g, " ").trim();
      prev.items = items;
      continue;
    }
    if (prev && !items.length && title.length < 20 && prev.items.length === 0) {
      prev.title = `${prev.title} ${title}`.replace(/\s+/g, " ").trim();
      continue;
    }
    out.push({ title, items });
  }
  return out.filter((c) => c.title || c.items.length);
}

function applyList(
  fields: ParsedJobDescriptionFields,
  field: ListField,
  body: string,
  splitComma = false,
) {
  let items = linesToList(body, splitComma);
  if (field === "required_trainings") {
    items = items.filter((i) => !/сертификат|зөвшөөрөл|лиценз/i.test(i));
  }
  if (field === "duties") {
    items = items.filter(
      (i) =>
        !/ерөнхий\s+шаардлага|боловсролын\s+түвшин|мэргэжлийн\s+ур\s+чадвар/i.test(
          i,
        ),
    );
  }
  if (!items.length) return;
  (fields as Record<string, unknown>)[field] = items;
}

function applyScalar(
  fields: ParsedJobDescriptionFields,
  field: ScalarField,
  body: string,
) {
  const text = body.trim();
  if (!text) return;
  // Single-line scalars: take first paragraph only if value looks huge due to bleed
  const firstBlock = text.split(/\n{2,}/)[0]?.trim() || text;
  const value =
    field === "purpose" ||
    field === "schedule" ||
    field === "position_note" ||
    field === "education_level" ||
    field === "work_experience" ||
    field === "property_liability" ||
    field === "other_notes" ||
    field === "resources"
      ? text
      : firstBlock.split("\n")[0]?.trim() || firstBlock;
  (fields as Record<string, unknown>)[field] = value;
}

function parseProfessionalFromBody(body: string) {
  const lines = body
    .split(/\n+/)
    .map((l) => l.replace(/^[•\-–—*]\s+/, "").trim())
    .filter(Boolean);
  const cats: Array<{ title: string; items: string[] }> = [];
  let current: { title: string; items: string[] } | null = null;
  for (const line of lines) {
    const isBullet = /^[-–—]/.test(line) || line.length > 80;
    if (!isBullet && line.length <= 60 && !/^[а-яөүёa-z0-9].*[.。;；]$/i.test(line)) {
      if (current) cats.push(current);
      current = { title: line.replace(/^[-–—]\s*/, ""), items: [] };
      continue;
    }
    if (!current) current = { title: "Мэргэжлийн ур чадвар", items: [] };
    current.items.push(line.replace(/^[-–—]\s*/, ""));
  }
  if (current) cats.push(current);
  return cats.filter((c) => c.title || c.items.length);
}

function setFieldFromLabel(
  fields: ParsedJobDescriptionFields,
  map: LabelKind,
  body: string,
) {
  const text = body.trim();
  if (!text || map.kind === "skip") return;
  if (map.kind === "scalar") applyScalar(fields, map.field, text);
  else if (map.kind === "list") applyList(fields, map.field, text, map.splitComma);
  else if (map.kind === "communication") applyCommunication(fields, text);
  else if (map.kind === "professional") {
    const cats = parseProfessionalFromBody(text);
    if (cats.length) fields.professional_skills = cats;
  } else if (map.kind === "certificates_header") {
    applyList(fields, "required_certificates", text);
  }
}

/**
 * Label/value stream parser — works for Загвар.docx raw text
 * (label on one line, value on following lines until next label).
 */
export function parseJobDescriptionText(raw: string): ParsedJobDescriptionFields {
  const text = cleanJobDescriptionText(raw);
  const fields: ParsedJobDescriptionFields = {
    markdown_body: text || null,
  };
  if (!text) return fields;

  const lines = text.split("\n");
  type Block = { map: LabelKind; buf: string[] };
  let current: Block | null = null;

  const flush = () => {
    if (!current) return;
    setFieldFromLabel(fields, current.map, current.buf.join("\n"));
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (current) current.buf.push("");
      continue;
    }
    if (isSectionBanner(line) && !matchLabel(line)) {
      flush();
      continue;
    }
    // "Label: value on same line"
    const cleanedLine = line.replace(/\*{1,2}/g, "").trim();
    const sameLine = cleanedLine.match(/^(.{2,120}?)[:：]\s*(.+)$/);
    if (sameLine) {
      const map = matchLabel(sameLine[1]);
      if (map && map.kind !== "skip") {
        flush();
        setFieldFromLabel(fields, map, sameLine[2]);
        continue;
      }
    }
    const map = matchLabel(cleanedLine);
    if (map) {
      flush();
      if (map.kind === "skip") continue;
      current = { map, buf: [] };
      continue;
    }
    if (current) current.buf.push(line);
  }
  flush();

  // Duties table often has header "№" / "Албан тушаалын гүйцэтгэх ажил үүрэг"
  // then bare paragraphs — if duties empty, extract between C and D.
  if (!fields.duties?.length) {
    const dutyBlock = text.match(
      /(?:с|c)\.\s*албан\s+тушаалын\s+гүйцэтгэх\s+үүрэг([\s\S]*?)(?:d\.\s*албан\s+тушаалд\s+тавигдах|$)/i,
    );
    if (dutyBlock) {
      const items = dutyBlock[1]
        .split(/\n+/)
        .map((l) => l.trim())
        .filter(
          (l) =>
            l &&
            !/^№$/.test(l) &&
            !/гүйцэтгэх\s+ажил\s+үүрэг/i.test(l) &&
            l.length > 20,
        );
      if (items.length) fields.duties = items;
    }
  }

  // Title from document heading / first H1 if missing
  if (!fields.title) {
    const h1 = text.match(/^#\s+(.+)$/m);
    if (h1) fields.title = h1[1].trim();
  }
  if (!fields.title) {
    const heading = text
      .split("\n")
      .map((l) => l.trim())
      .find((l) => /албан\s+тушаалын\s+тодорхойлолт/i.test(l) && l.length < 160);
    if (heading) {
      fields.title = heading
        .replace(/\s*албан\s+тушаалын\s+тодорхойлолт\s*/i, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
  }
  if (!fields.title) {
    const first = text
      .split("\n")
      .map((l) => l.trim())
      .find(
        (l) =>
          l &&
          l.length < 100 &&
          !matchLabel(l) &&
          !isSectionBanner(l) &&
          !/^(\*\*|ID:)/i.test(l),
      );
    if (first) fields.title = first.replace(/^#+\s*/, "").trim();
  }

  // National code pattern if still missing
  if (!fields.a_code) {
    const m = text.match(
      /үндэсний\s+ажил\s+мэргэжлийн\s+ангиллын\s+код\s*[:：]?\s*(\d{3,5}-\d{1,3})/i,
    );
    if (m) fields.a_code = m[1];
  }
  if (!fields.position_code) {
    const m = text.match(/албан\s+тушаалын\s+код\s*[:：]?\s*(\d{1,6})\b/i);
    if (m) fields.position_code = m[1];
  }

  return fields;
}

/**
 * Parse mammoth HTML tables from Загвар.docx-like documents.
 */
export function parseJobDescriptionHtml(html: string): ParsedJobDescriptionFields {
  const fields: ParsedJobDescriptionFields = {
    markdown_body: stripHtml(html) || null,
  };
  if (!html.trim()) return fields;

  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
  const duties: string[] = [];
  const skillCats: Array<{ title: string; items: string[] }> = [];
  let inDutiesTable = false;
  let pendingProfessionalLabel = false;
  let awaitingCertificates = false;

  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(html))) {
    const rowHtml = rowMatch[1];
    const rawCells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    const localCellRe = new RegExp(cellRe.source, "gi");
    while ((cellMatch = localCellRe.exec(rowHtml))) {
      rawCells.push(cellMatch[1]);
    }
    if (!rawCells.length) continue;

    const cells = rawCells.map((c) => stripHtml(c));
    const inlineCells = rawCells.map((c) => stripHtmlInline(c));
    const joined = cells.join(" | ");

    // End duties table before D / requirements content.
    if (
      inDutiesTable &&
      (/тавигдах\s+шаардлага|ерөнхий\s+шаардлага|боловсролын\s+түвшин|бусад\s+хүчин|[abcdeавс]\.\s*албан/i.test(
        joined,
      ) ||
        matchLabel(cells[0]))
    ) {
      inDutiesTable = false;
    }

    if (
      /гүйцэтгэх\s+ажил\s+үүрэг/i.test(joined) ||
      (cells[0] === "№" && cells.length >= 2)
    ) {
      inDutiesTable = true;
      continue;
    }

    if (inDutiesTable) {
      const duty = (cells.length >= 2 ? cells[cells.length - 1] : cells[0]).trim();
      if (
        duty &&
        duty !== "№" &&
        !/гүйцэтгэх\s+ажил\s+үүрэг/i.test(duty) &&
        duty.length > 15
      ) {
        duties.push(duty);
      }
      continue;
    }

    // Orphan communication continuation row (rowspan value cell only).
    if (
      cells.length === 1 ||
      (cells.length === 2 && !normalizeLabel(cells[0]))
    ) {
      const only = cells[cells.length - 1] ?? "";
      if (/^[-–—]?\s*(компани\s*дотор|гадна)\s*[:：]/i.test(only)) {
        applyCommunication(fields, only);
        continue;
      }
    }

    // Professional skill continuation rows after rowspan label (2 cells).
    if (pendingProfessionalLabel && cells.length === 2) {
      const catTitle = inlineCells[0];
      const catItems = linesToList(cells[1]);
      if (
        catTitle &&
        catTitle.length < 80 &&
        !matchLabel(catTitle) &&
        catItems.length > 0
      ) {
        skillCats.push({ title: catTitle, items: catItems });
        continue;
      }
    }

    // Professional skill 3-column row
    if (cells.length >= 3) {
      const maybeLabel = normalizeLabel(inlineCells[0]);
      const catTitle = inlineCells[1];
      const catItems = linesToList(cells[2]);
      if (
        /мэргэжлийн\s+(?:ур\s+)?чадвар/i.test(maybeLabel) ||
        pendingProfessionalLabel ||
        (catTitle.length > 0 &&
          catTitle.length < 80 &&
          catItems.length > 0 &&
          /дүн\s+шинжилгээ|асуудал\s+шийдвэрлэх|багаар\s+ажиллах|хийх/i.test(
            catTitle,
          ))
      ) {
        pendingProfessionalLabel =
          /мэргэжлийн/i.test(maybeLabel) || pendingProfessionalLabel;
        skillCats.push({
          title: catTitle || "Мэргэжлийн ур чадвар",
          items: catItems,
        });
        continue;
      }
    }

    if (cells.length >= 2) {
      const labelCell = inlineCells[0];
      const valueCell = cells.slice(1).join("\n").trim();
      const map = matchLabel(labelCell);
      if (map && map.kind !== "skip") {
        if (map.kind === "professional") {
          pendingProfessionalLabel = true;
          if (valueCell) {
            skillCats.push(...parseProfessionalFromBody(valueCell));
          }
        } else if (map.kind === "certificates_header") {
          awaitingCertificates = true;
          if (valueCell) applyList(fields, "required_certificates", valueCell);
        } else {
          setFieldFromLabel(fields, map, valueCell);
        }
        continue;
      }
    } else if (cells.length === 1) {
      const map = matchLabel(inlineCells[0]);
      if (map?.kind === "professional") pendingProfessionalLabel = true;
      if (map?.kind === "certificates_header") awaitingCertificates = true;
      if (awaitingCertificates && map?.kind !== "certificates_header") {
        // single-cell value after certificate header
        if (!matchLabel(inlineCells[0])) {
          applyList(fields, "required_certificates", cells[0]);
          awaitingCertificates = false;
        }
      }
    }
  }

  if (duties.length) fields.duties = duties;
  const coalesced = coalesceSkillCategories(skillCats);
  if (coalesced.length) fields.professional_skills = coalesced;

  // Fill gaps from text parse; HTML structured fields win.
  const fromText = parseJobDescriptionText(stripHtml(html));
  return mergeParsedIntoDraft(fromText, fields);
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        if (typeof o.text === "string") return o.text.trim();
        if (typeof o.name === "string") return o.name.trim();
      }
      return String(item ?? "").trim();
    })
    .filter(Boolean);
}

/** Accept export-style JSON (single object or `{ job_description: ... }`). */
export function parseJobDescriptionJson(
  raw: string,
): ParsedJobDescriptionFields {
  const data = JSON.parse(raw) as unknown;
  const obj = (
    data &&
    typeof data === "object" &&
    !Array.isArray(data) &&
    "job_description" in (data as object)
      ? (data as { job_description: unknown }).job_description
      : Array.isArray(data)
        ? data[0]
        : data
  ) as Record<string, unknown>;

  if (!obj || typeof obj !== "object") {
    throw new Error("JSON дотор ажлын байрны тодорхойлолт олдсонгүй.");
  }

  return {
    title: obj.title != null ? String(obj.title) : null,
    a_code: obj.a_code != null ? String(obj.a_code) : null,
    position_code:
      obj.position_code != null ? String(obj.position_code) : null,
    company_name: obj.company_name != null ? String(obj.company_name) : null,
    location: obj.location != null ? String(obj.location) : null,
    unit_name: obj.unit_name != null ? String(obj.unit_name) : null,
    job_condition:
      obj.job_condition != null ? String(obj.job_condition) : null,
    purpose: obj.purpose != null ? String(obj.purpose) : null,
    schedule: obj.schedule != null ? String(obj.schedule) : null,
    daily_hours: obj.daily_hours != null ? String(obj.daily_hours) : null,
    break_time: obj.break_time != null ? String(obj.break_time) : null,
    position_note:
      obj.position_note != null ? String(obj.position_note) : null,
    duties: asStringArray(obj.duties) ?? [],
    education_level:
      obj.education_level != null ? String(obj.education_level) : null,
    work_experience:
      obj.work_experience != null ? String(obj.work_experience) : null,
    general_skills: asStringArray(obj.general_skills) ?? [],
    professional_skills: Array.isArray(obj.professional_skills)
      ? (obj.professional_skills as ParsedJobDescriptionFields["professional_skills"])
      : [],
    authority: asStringArray(obj.authority) ?? [],
    responsibilities: asStringArray(obj.responsibilities) ?? [],
    relevant_laws: asStringArray(obj.relevant_laws) ?? [],
    resources: obj.resources != null ? String(obj.resources) : null,
    required_trainings: asStringArray(obj.required_trainings) ?? [],
    required_certificates: asStringArray(obj.required_certificates) ?? [],
    property_liability:
      obj.property_liability != null ? String(obj.property_liability) : null,
    other_notes: obj.other_notes != null ? String(obj.other_notes) : null,
    communication_scope: obj.communication_scope ?? null,
    supervisor_positions: asStringArray(obj.supervisor_positions) ?? [],
    subordinate_positions: asStringArray(obj.subordinate_positions) ?? [],
    markdown_body:
      obj.markdown_body != null ? String(obj.markdown_body) : null,
  };
}

/** Merge parsed upload into existing draft (non-empty parsed values win). */
export function mergeParsedIntoDraft(
  current: Record<string, unknown> | null | undefined,
  parsed: ParsedJobDescriptionFields,
): ParsedJobDescriptionFields {
  const out: ParsedJobDescriptionFields = {
    ...(current as ParsedJobDescriptionFields | null | undefined),
  };

  const take = <K extends keyof ParsedJobDescriptionFields>(key: K) => {
    const v = parsed[key];
    if (v == null) return;
    if (typeof v === "string" && !v.trim()) return;
    if (Array.isArray(v) && v.length === 0) return;

    if (
      key === "communication_scope" &&
      v &&
      typeof v === "object" &&
      !Array.isArray(v)
    ) {
      const prev =
        out.communication_scope &&
        typeof out.communication_scope === "object" &&
        !Array.isArray(out.communication_scope)
          ? (out.communication_scope as Record<string, string>)
          : {};
      const next = v as Record<string, string>;
      out.communication_scope = {
        company_internal:
          (next.company_internal || prev.company_internal || "").trim(),
        external: (next.external || prev.external || "").trim(),
      };
      return;
    }

    out[key] = v as ParsedJobDescriptionFields[K];
  };

  (
    [
      "title",
      "a_code",
      "position_code",
      "company_name",
      "location",
      "unit_name",
      "job_condition",
      "purpose",
      "schedule",
      "daily_hours",
      "break_time",
      "position_note",
      "duties",
      "education_level",
      "work_experience",
      "general_skills",
      "professional_skills",
      "authority",
      "responsibilities",
      "relevant_laws",
      "resources",
      "required_trainings",
      "required_certificates",
      "property_liability",
      "other_notes",
      "communication_scope",
      "supervisor_positions",
      "subordinate_positions",
      "markdown_body",
    ] as const
  ).forEach(take);

  return out;
}
