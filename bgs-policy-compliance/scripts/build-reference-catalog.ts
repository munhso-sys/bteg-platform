#!/usr/bin/env tsx
/**
 * Build org catalog from Unit-JD-Policy reference.xlsx and remap local DB.
 *
 * npm run reference:build
 */

import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import * as XLSX from "xlsx";

const ROOT = process.cwd();
const XLSX_PATH = path.join(
  ROOT,
  "data",
  "reference",
  "Unit-JD-Policy-reference.xlsx",
);
const CATALOG_PATH = path.join(ROOT, "data", "reference", "org-catalog.json");
const MAP_PATH = path.join(ROOT, "data", "local", "reference-map.json");
const DB_PATH = path.join(ROOT, "data", "local", "db.json");

export type RefAlba = {
  id: string;
  name: string;
  code: string;
  heltes_id: string;
  position_codes: string[];
  policy_titles: string[];
};

export type RefHeltes = {
  id: string;
  name: string;
  code: string;
  albas: RefAlba[];
  policy_titles: string[];
};

export type OrgCatalog = {
  source: string;
  built_at: string;
  heltes: RefHeltes[];
  other: {
    id: "other";
    name: "Бусад";
  };
};

export type ReferenceMap = {
  built_at: string;
  position_to_alba: Record<string, string>;
  /** A policy may belong to multiple albas (e.g. өрөмдлөг → зүүн+баруун). */
  policy_to_org: Record<string, Array<{ type: "heltes" | "alba"; id: string }>>;
  unmatched_positions: Array<{ id: string; name: string }>;
  unmatched_policies: Array<{ id: string; name: string }>;
  stats: Record<string, number>;
};

function displayName(raw: string): string {
  let s = String(raw || "")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Normalize trailing Хэлтэс casing
  s = s.replace(/\s+Хэлтэс$/u, " хэлтэс").replace(/\s+Алба$/u, " алба");
  return s;
}

function isGenericPositionCode(code: string): boolean {
  const n = normalizeMatch(code);
  return (
    n === "дарга албаны" ||
    n === "дарга хэлтсийн" ||
    n === "дарга орлогч" ||
    n === "дарга албаны орлогч" ||
    n === "бүгд" ||
    n === "бүгд1"
  );
}

const HELTES_ALIASES: Array<{ match: RegExp; heltesIncludes: string }> = [
  { match: /дотоод\s+хяналт/i, heltesIncludes: "дотоод хяналт" },
  { match: /хабэа/i, heltesIncludes: "хабэа" },
  { match: /байгаль\s+орч/i, heltesIncludes: "байгаль орч" },
  { match: /үйлд(ь|в)эрлэл/i, heltesIncludes: "үйлдвэрлэл" },
  { match: /санхүү|эдийн\s+засаг|бүртгэл/i, heltesIncludes: "санхүү" },
  { match: /захиргаа/i, heltesIncludes: "захиргаа" },
  { match: /хүний\s+нөөц/i, heltesIncludes: "захиргаа" },
];

function policyNormalize(raw: string): string {
  return normalizeMatch(raw)
    .replace(/солилн?цох|солилцлох/g, "солилцох")
    .replace(/кемп(и|э)д/g, "кемпид")
    .replace(/хабэа[-\s]*(ийн|н)/g, "хабэа н")
    .replace(/өрөмдлөг(ө)?/g, "өрөмдлөгө")
    .replace(/авто\s*тээвр/g, "автотээвр")
    .replace(/лабратор(ийн|ын)?|лаборатор(ы|ийн)?/g, "лабораторийн")
    .replace(/захиргааны\s+зөвлөл(ийн)?(\s+хурл(ыг|ын))?(\s+зохион\s+байгуулах)?/g, "зөвлөлийн хурлын")
    .replace(/зөвлөлийн\s+хурлын(\s+журам)?/g, "зөвлөлийн хурлын")
    .replace(/удирдлагын\s+дэргэдэх\s+/g, "")
    .replace(/баянгол\s+уурхайн(\s+ажилтнуудын)?\s+/g, "")
    .replace(/сургалт\s+(явуулах|орох)/g, "сургалт орох")
    .replace(/цалин(\s+олгох|\s+хөлсний)?/g, "цалин")
    .replace(/үнэлгээ\s+холбосон/g, "");
}

function scorePolicy(a: string, b: string): number {
  const na = policyNormalize(a);
  const nb = policyNormalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;
  if (na.includes(nb) || nb.includes(na)) return 88;
  return scoreName(na, nb);
}

function slugify(raw: string): string {
  return displayName(raw)
    .toLocaleLowerCase("mn")
    .replace(/ё/g, "е")
    .replace(/[^a-z0-9а-яөүё\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function normalizeMatch(raw: string): string {
  return String(raw || "")
    .replace(/^\[|\]$/g, "")
    .replace(/reg[_\s-]?\d+/gi, "")
    .replace(/[_/,.-]+/g, " ")
    .replace(/\d+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("mn")
    .replace(/ё/g, "е");
}

function tokens(raw: string): string[] {
  return normalizeMatch(raw)
    .split(" ")
    .map((t) => t.trim())
    .filter((t) => t.length > 1);
}

function scoreName(a: string, b: string): number {
  const na = normalizeMatch(a);
  const nb = normalizeMatch(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;
  if (na.includes(nb) || nb.includes(na)) return 85;
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = new Set([...ta, ...tb]).size;
  const jaccard = inter / union;
  const coverage = inter / Math.min(ta.size, tb.size);
  return Math.round((jaccard * 0.55 + coverage * 0.45) * 80);
}

/** Expand known abbreviations to fuller labels for display/matching. */
const CODE_ALIASES: Record<string, string[]> = {
  дхшх: ["дотоод хяналт шалгалтын хэлтэс", "дотоод хяналтын хэлтэс"],
  бох: ["байгаль орчны хэлтэс"],
  хабэах: ["хабэа хэлтэс", "хабэа-н хэлтэс", "хабэа"],
  захиргаа: ["захиргаа удирдлагын хэлтэс", "захиргаа"],
};

function parseJobSheet(wb: XLSX.WorkBook): {
  heltes: RefHeltes[];
  albaByCode: Map<string, RefAlba>;
} {
  const grid = XLSX.utils.sheet_to_json<(string | number | null)[]>(
    wb.Sheets["Ажлын байр"],
    { header: 1, defval: null },
  ) as (string | null)[][];

  const header = grid[0] || [];
  const HELTES_COLS = [0, 1, 2, 3, 4, 5];

  // Heltes → child alba codes
  const heltes: RefHeltes[] = [];
  const albaByCode = new Map<string, RefAlba>();

  for (const col of HELTES_COLS) {
    const heltesCode = header[col];
    if (!heltesCode) continue;
    const heltesName = displayName(heltesCode);
    const heltesId = `heltes:${slugify(heltesName)}`;
    const childCodes: string[] = [];
    for (let r = 1; r < grid.length; r++) {
      const v = grid[r]?.[col];
      if (v != null && String(v).trim()) childCodes.push(String(v).trim());
    }

    const h: RefHeltes = {
      id: heltesId,
      name: heltesName,
      code: String(heltesCode),
      albas: [],
      policy_titles: [],
    };

    for (const code of childCodes) {
      const albaName = displayName(code);
      const albaId = `alba:${slugify(albaName)}`;
      const alba: RefAlba = {
        id: albaId,
        name: albaName,
        code,
        heltes_id: heltesId,
        position_codes: [],
        policy_titles: [],
      };
      h.albas.push(alba);
      albaByCode.set(normalizeMatch(code), alba);
      albaByCode.set(normalizeMatch(albaName), alba);
    }
    heltes.push(h);
  }

  // Position columns start at col 8
  for (let col = 8; col < header.length; col++) {
    const code = header[col];
    if (!code) continue;
    const key = normalizeMatch(String(code));
    let alba = albaByCode.get(key);
    if (!alba) {
      // Create orphan under matching heltes if possible later; for now attach by code scan
      const name = displayName(String(code));
      alba = {
        id: `alba:${slugify(name)}`,
        name,
        code: String(code),
        heltes_id: "",
        position_codes: [],
        policy_titles: [],
      };
      albaByCode.set(key, alba);
    }
    for (let r = 1; r < grid.length; r++) {
      const v = grid[r]?.[col];
      if (v == null) continue;
      const pos = String(v).trim().replace(/\d+$/, "");
      if (pos) alba.position_codes.push(pos);
    }
    alba.position_codes = [...new Set(alba.position_codes)];
  }

  // Attach any alba that was only in position headers into a heltes if missing
  for (const alba of albaByCode.values()) {
    if (alba.heltes_id) continue;
    // try find heltes that lists this code
    for (const h of heltes) {
      if (h.albas.some((a) => a.id === alba.id)) {
        alba.heltes_id = h.id;
        break;
      }
    }
    if (!alba.heltes_id) {
      // leave for Бусад via matching only
    }
  }

  // Ensure all albas with heltes_id are in heltes.albas arrays
  for (const alba of albaByCode.values()) {
    if (!alba.heltes_id) continue;
    const h = heltes.find((x) => x.id === alba.heltes_id);
    if (h && !h.albas.some((a) => a.id === alba.id)) h.albas.push(alba);
  }

  return { heltes, albaByCode };
}

function parsePolicySheet(
  wb: XLSX.WorkBook,
  heltes: RefHeltes[],
  albaByCode: Map<string, RefAlba>,
) {
  const grid = XLSX.utils.sheet_to_json<(string | null)[]>(wb.Sheets["Журам"], {
    header: 1,
    defval: null,
  }) as (string | null)[][];
  const header = grid[0] || [];

  for (let col = 0; col < header.length; col++) {
    const orgRaw = header[col];
    if (!orgRaw) continue;
    const orgName = displayName(String(orgRaw));
    const orgKey = normalizeMatch(orgName);
    const titles: string[] = [];
    for (let r = 1; r < grid.length; r++) {
      const v = grid[r]?.[col];
      if (v != null && String(v).trim()) titles.push(String(v).trim());
    }

    // Prefer alba match (e.g. ХҮНИЙ НӨӨЦИЙН АЛБА)
    let alba = albaByCode.get(orgKey);
    if (!alba) {
      for (const [k, a] of albaByCode) {
        if (scoreName(k, orgKey) >= 80) {
          alba = a;
          break;
        }
      }
    }
    // HR written as full phrase
    if (!alba && /хүний\s+нөөц/i.test(orgName)) {
      alba = [...albaByCode.values()].find((a) =>
        /хүний\s+нөөц/i.test(a.name),
      );
    }
    if (alba) {
      alba.policy_titles.push(...titles);
      continue;
    }

    // Else heltes match (including aliases / typos)
    let heltesHit = heltes.find(
      (h) =>
        normalizeMatch(h.name) === orgKey || scoreName(h.name, orgName) >= 72,
    );
    if (!heltesHit) {
      for (const alias of HELTES_ALIASES) {
        if (!alias.match.test(orgName)) continue;
        heltesHit = heltes.find((h) =>
          normalizeMatch(h.name).includes(alias.heltesIncludes),
        );
        if (heltesHit) break;
      }
    }
    if (heltesHit) {
      heltesHit.policy_titles.push(...titles);
      continue;
    }

    console.warn("Unmapped policy org column:", orgName);
  }

  for (const h of heltes) {
    h.policy_titles = [...new Set(h.policy_titles)];
    for (const a of h.albas) a.policy_titles = [...new Set(a.policy_titles)];
  }

  // Split heltes-bucket policies onto matching albas by title keywords
  for (const h of heltes) {
    redistributeHeltesPoliciesToAlbas(h);
  }

  applyCatalogCorrections(heltes);
}

/**
 * Manual overrides for known Excel quirks (wrong JD columns, single-alba fold).
 */
/** Excel abbreviations → clear display names (code stays short for JD-*). */
const ALBA_FULL_NAMES: Record<string, string> = {
  дхшх: "Дотоод хяналт шалгалтын хэлтэс",
  бох: "Байгаль орчны хэлтэс",
  хабэах: "ХАБЭА хэлтэс",
  захиргаа: "Захиргааны нэгж",
};

function applyCatalogCorrections(heltes: RefHeltes[]) {
  for (const h of heltes) {
    // Expand cryptic abbreviations to full хэлтэс/нэгж names
    for (const a of h.albas) {
      const key = normalizeMatch(a.code || a.name);
      if (ALBA_FULL_NAMES[key]) {
        a.name = ALBA_FULL_NAMES[key];
      }
    }

    // Дотоод хяналт / ДХШХ: Excel JD list + user overrides
    if (/дотоод\s+хяналт/i.test(h.name)) {
      for (const a of h.albas) {
        // Drop mis-filed барилга engineers
        a.position_codes = a.position_codes.filter((c) => !/барилга/i.test(c));
        // Excel JD roles for ДХШХ (no алба under this хэлтэс → no Дарга-Албаны)
        const wanted = [
          "Дарга-Хэлтсийн",
          "Мэргэжилтэн-Хяналт_Шалгалтын-Ахлах",
          "Мэргэжилтэн-Хяналт_Шалгалтын",
        ];
        const have = new Set(a.position_codes.map((c) => normalizeMatch(c)));
        for (const w of wanted) {
          if (!have.has(normalizeMatch(w))) a.position_codes.push(w);
        }
        // Drop Дарга-Албаны if present from Excel/prior runs
        a.position_codes = wanted.filter((w) =>
          a.position_codes.some((c) => normalizeMatch(c) === normalizeMatch(w)),
        );
        // No separate алба — show хэлтэсийн бүрэн нэр
        a.name = "Дотоод хяналт шалгалтын хэлтэс";
      }
    }

    // Single-alba хэлтэс: fold leftover heltes policies onto that alba
    // so UI shows one row (positions + policies) instead of a synthetic
    // "Хэлтэсийн нийтлэг журам" sibling.
    if (h.albas.length === 1 && h.policy_titles.length) {
      const a = h.albas[0];
      for (const t of h.policy_titles) {
        if (!a.policy_titles.includes(t)) a.policy_titles.push(t);
      }
      h.policy_titles = [];
    }
  }
}

/**
 * Policies listed under a heltes column (e.g. Үйлдвэрлэлийн хэлтэс) often
 * name a specific алба. Move them onto that alba; keep only department-wide
 * leftovers on the heltes.
 */
function redistributeHeltesPoliciesToAlbas(heltes: RefHeltes) {
  if (!heltes.albas.length || !heltes.policy_titles.length) return;

  const remaining: string[] = [];
  for (const title of heltes.policy_titles) {
    const targets = matchPolicyTitleToAlbas(title, heltes.albas);
    if (!targets.length) {
      remaining.push(title);
      continue;
    }
    for (const alba of targets) {
      if (!alba.policy_titles.includes(title)) alba.policy_titles.push(title);
    }
  }
  heltes.policy_titles = remaining;
}

function matchPolicyTitleToAlbas(title: string, albas: RefAlba[]): RefAlba[] {
  const t = normalizeMatch(title);

  // Explicit keyword → alba name fragment(s). First match wins group.
  const RULES: Array<{ re: RegExp; albaIncludes: string[] }> = [
    { re: /төлөвлөлт\s+хяналт/, albaIncludes: ["төлөвлөлт"] },
    { re: /маркшейдер/, albaIncludes: ["маркшейдер"] },
    { re: /геотехник/, albaIncludes: ["геотехник"] },
    { re: /геологи|чанар(ын)?\s+алб|лаборатор|химийн\s+бодис|технологийн\s+дээж/, albaIncludes: ["геологи"] },
    { re: /баяжуулалт/, albaIncludes: ["баяжуулалт"] },
    { re: /цахилгаан/, albaIncludes: ["цахилгаан"] },
    { re: /автотээвр|түлш\s+түгээх/, albaIncludes: ["автотээвр"] },
    { re: /ачилт|буулгалт/, albaIncludes: ["ачилт"] },
    { re: /тоног\s+төхөөрөмж|техник.+\s+засвар\s+ашиглалт/, albaIncludes: ["тоног төхөөрөмж"] },
    { re: /хмм|засварын\s+алб/, albaIncludes: ["хмм"] },
    { re: /өрөмдлөг|тэсэлгээ/, albaIncludes: ["баруун олборлолт", "зүүн олборлолт"] },
  ];

  for (const rule of RULES) {
    if (!rule.re.test(t)) continue;
    const hits = albas.filter((a) =>
      rule.albaIncludes.some((frag) => normalizeMatch(a.name).includes(frag)),
    );
    if (hits.length) return hits;
  }

  // Fuzzy: policy title mentions alba name tokens
  const scored = albas
    .map((a) => {
      const an = normalizeMatch(a.name)
        .replace(/\s+алба$/u, "")
        .replace(/хммзасварын/u, "хмм засварын");
      let s = 0;
      if (t.includes(an) || an.length > 4 && t.includes(an.slice(0, Math.min(an.length, 10)))) {
        s = 90;
      } else {
        s = scoreName(title, a.name);
      }
      // Department-wide markers should NOT bind to a random alba
      if (/хэлтсийн\s+үйл\s+ажиллагаа|дрон|цоож\s+пайз|техникийн\s+комисс/i.test(t)) {
        s = 0;
      }
      return { a, s };
    })
    .filter((x) => x.s >= 72)
    .sort((x, y) => y.s - x.s);

  if (!scored.length) return [];
  // Only top score group (avoid attaching one policy to all albas)
  const top = scored[0].s;
  return scored.filter((x) => x.s >= top - 5).map((x) => x.a).slice(0, 3);
}

function bestPositionMatch(
  position: {
    name: string;
    alba_name?: string | null;
    heltes_name?: string | null;
  },
  candidates: Array<{
    albaId: string;
    albaName: string;
    heltesName: string;
    code: string;
  }>,
): { albaId: string; code: string; score: number } | null {
  let best: { albaId: string; code: string; score: number } | null = null;
  const posCtx = `${position.name} ${position.alba_name ?? ""} ${position.heltes_name ?? ""}`;
  const nameNorm = normalizeMatch(position.name);

  for (const c of candidates) {
    let s = scoreName(position.name, c.code);

    const excelTokens = tokens(c.code);
    if (excelTokens.length >= 2) {
      const reversed = [...excelTokens].reverse().join(" ");
      s = Math.max(s, scoreName(position.name, reversed));
    }

    // Context boost: existing BGS alba/heltes names
    const albaCtx = scoreName(position.alba_name ?? "", c.albaName);
    const heltesCtx = scoreName(position.heltes_name ?? "", c.heltesName);
    if (albaCtx >= 70) s += 25;
    else if (heltesCtx >= 70) s += 12;

    // Heltes name tokens inside position title (e.g. дотоод хяналт … хэлтсийн дарга)
    const heltesTokens = tokens(c.heltesName).filter(
      (t) => !["алба", "хэлтэс", "дэх", "ын", "ийн"].includes(t) && t.length > 3,
    );
    const heltesNameHits = heltesTokens.filter((t) => nameNorm.includes(t)).length;
    if (heltesNameHits > 0) s += Math.min(24, heltesNameHits * 10);

    // Abbreviation aliases (ДХШХ ↔ дотоод хяналт)
    const aliasKey = normalizeMatch(c.albaName);
    for (const alias of CODE_ALIASES[aliasKey] ?? []) {
      if (nameNorm.includes(normalizeMatch(alias).slice(0, 12))) {
        s += 18;
        break;
      }
    }

    // Distinctive alba tokens in position name (e.g. Автотээврийн албаны дарга)
    const albaTokens = tokens(c.albaName).filter(
      (t) => !["алба", "хэлтэс", "дэх"].includes(t),
    );
    const distinctiveHits = albaTokens.filter((t) => nameNorm.includes(t)).length;
    if (distinctiveHits > 0) s += Math.min(30, distinctiveHits * 12);

    // Дарга role phrasing in free-text titles
    const codeN = normalizeMatch(c.code);
    if (codeN.includes("дарга") && codeN.includes("хэлтсийн")) {
      if (/хэлтс(ийн|ийн)?\s+дарга|дарга\s+хэлтс/u.test(nameNorm)) s = Math.max(s, 78);
    }
    if (codeN.includes("дарга") && codeN.includes("албаны")) {
      if (/албаны\s+дарга|дарга\s+алба/u.test(nameNorm)) s = Math.max(s, 78);
    }

    // Generic codes require context — don't dump all "албаны дарга" into one alba
    if (isGenericPositionCode(c.code)) {
      const hasAlbaHint =
        albaCtx >= 70 ||
        distinctiveHits > 0 ||
        albaTokens.some((t) => normalizeMatch(posCtx).includes(t));
      const hasHeltesHint = heltesCtx >= 70 || heltesNameHits > 0;
      const nameHasDarga = /дарга/u.test(nameNorm);
      if (!hasAlbaHint && !hasHeltesHint) {
        s = Math.min(s, 40);
      } else if (!hasAlbaHint && hasHeltesHint) {
        // Only promote хэлтсийн дарга when the title itself is a дарга role
        if (codeN.includes("хэлтсийн") && nameHasDarga) s = Math.max(s, 70);
        else if (codeN.includes("албаны") && nameHasDarga) s = Math.max(s, 70);
        else s = Math.min(s, 50);
      }
    }

    // Ахлах vs non-ахлах must not collapse
    if (/ахлах/u.test(codeN) !== /ахлах/u.test(nameNorm)) s -= 25;

    if (
      !best ||
      s > best.score ||
      (s === best.score && c.code.length > best.code.length)
    ) {
      best = { albaId: c.albaId, code: c.code, score: s };
    }
  }
  return best && best.score >= 68 ? best : null;
}

function makeJdCode(albaCode: string, index: number): string {
  const base = String(albaCode || "ALBA")
    .replace(/[_\s]+/g, "")
    .toLocaleUpperCase("mn")
    .slice(0, 12);
  return `JD-${base}-${String(index).padStart(2, "0")}`;
}

function mergePositionRefs(
  db: {
    clause_position_responsibilities: Array<{
      id: string;
      job_position_id: string;
      policy_clause_id: string;
      responsibility_type: string;
      is_active: boolean;
    }>;
    compliance_evaluations: Array<{ job_position_id: string }>;
    job_descriptions: Array<{ job_position_id: string }>;
  },
  winnerId: string,
  loserIds: string[],
) {
  const linkKey = (l: {
    policy_clause_id: string;
    job_position_id: string;
    responsibility_type: string;
  }) => `${l.policy_clause_id}|${l.job_position_id}|${l.responsibility_type}`;

  const winnerKeys = new Set(
    db.clause_position_responsibilities
      .filter((l) => l.job_position_id === winnerId && l.is_active)
      .map(linkKey),
  );

  for (const loserId of loserIds) {
    for (const link of db.clause_position_responsibilities) {
      if (link.job_position_id !== loserId) continue;
      const moved = { ...link, job_position_id: winnerId };
      if (winnerKeys.has(linkKey(moved))) {
        link.is_active = false;
      } else {
        link.job_position_id = winnerId;
        winnerKeys.add(linkKey(moved));
      }
    }
    for (const ev of db.compliance_evaluations) {
      if (ev.job_position_id === loserId) ev.job_position_id = winnerId;
    }
    for (const jd of db.job_descriptions) {
      if (jd.job_position_id === loserId) jd.job_position_id = winnerId;
    }
  }
}

/**
 * One Excel JD code → one active position per alba (dedupe BGS clones).
 * For Дотоод хяналт: invent JD-… codes, rename to Excel labels, create missing roles.
 */
function canonicalizeAlbaPositions(
  db: {
    job_positions: Array<{
      id: string;
      bteg_id: string | null;
      name: string;
      is_active: boolean;
      heltes_id: string | null;
      alba_id: string | null;
      heltes_name: string | null;
      alba_name: string | null;
      organization_id?: string | null;
      gazar_id?: string | null;
      org_unit_id?: string | null;
      description?: string | null;
      created_at?: string;
      updated_at?: string;
    }>;
    clause_position_responsibilities: Array<{
      id: string;
      job_position_id: string;
      policy_clause_id: string;
      responsibility_type: string;
      is_active: boolean;
    }>;
    compliance_evaluations: Array<{ job_position_id: string }>;
    job_descriptions: Array<{ job_position_id: string }>;
  },
  heltes: RefHeltes[],
  matches: Record<string, { albaId: string; code: string; score: number }>,
): Record<string, string> {
  const byId = new Map(db.job_positions.map((p) => [p.id, p]));
  const linkCount = (pid: string) =>
    db.clause_position_responsibilities.filter(
      (l) => l.is_active && l.job_position_id === pid,
    ).length;

  const position_to_alba: Record<string, string> = {};
  const now = new Date().toISOString();
  const claimed = new Set<string>();

  for (const h of heltes) {
    const fullSync = /дотоод\s+хяналт/i.test(h.name);
    for (const a of h.albas) {
      let seq = 1;
      for (const code of a.position_codes) {
        const codeKey = normalizeMatch(code);
        const candidates = Object.entries(matches)
          .filter(
            ([pid, m]) =>
              m.albaId === a.id &&
              normalizeMatch(m.code) === codeKey &&
              !claimed.has(pid),
          )
          .map(([pid, m]) => ({ pid, ...m, links: linkCount(pid) }))
          .sort((x, y) => y.links - x.links || y.score - x.score);

        const display = displayName(code);
        const jdCode = makeJdCode(a.code || a.name, seq++);

        if (candidates.length) {
          const winnerId = candidates[0].pid;
          const winner = byId.get(winnerId)!;
          const losers = candidates.slice(1).map((c) => c.pid);
          if (losers.length) mergePositionRefs(db, winnerId, losers);
          for (const lid of losers) {
            const loser = byId.get(lid);
            if (!loser) continue;
            loser.is_active = false;
            loser.description = `Merged into ${fullSync ? jdCode : winner.bteg_id} (${display})`;
            delete matches[lid];
            claimed.add(lid);
          }
          if (fullSync) {
            winner.name = display;
            winner.bteg_id = jdCode;
          }
          winner.alba_name = a.name;
          winner.heltes_name = h.name;
          winner.updated_at = now;
          position_to_alba[winnerId] = a.id;
          claimed.add(winnerId);
        } else if (fullSync) {
          const id = randomUUID();
          db.job_positions.push({
            id,
            bteg_id: jdCode,
            name: display,
            organization_id: null,
            gazar_id: null,
            heltes_id: null,
            alba_id: null,
            heltes_name: h.name,
            alba_name: a.name,
            org_unit_id: null,
            description: `Excel JD: ${a.code} / ${code}`,
            is_active: true,
            created_at: now,
            updated_at: now,
          });
          byId.set(id, db.job_positions[db.job_positions.length - 1]);
          position_to_alba[id] = a.id;
          claimed.add(id);
        }
      }
    }
  }

  // Keep other (non-ДХШХ) matched positions that weren't part of a duplicate group
  for (const [pid, m] of Object.entries(matches)) {
    if (claimed.has(pid)) continue;
    if (position_to_alba[pid]) continue;
    const p = byId.get(pid);
    if (!p?.is_active) continue;
    position_to_alba[pid] = m.albaId;
  }

  return position_to_alba;
}

function bestPolicyMatches(
  policyName: string,
  candidates: Array<{ org: { type: "heltes" | "alba"; id: string }; title: string }>,
): Array<{ type: "heltes" | "alba"; id: string }> {
  let bestScore = 0;
  const scored = candidates.map((c) => {
    let score = scorePolicy(policyName, c.title);
    // Strong keyword bridges for known Excel↔BGS title drift
    const pn = policyNormalize(policyName);
    const tn = policyNormalize(c.title);
    if (/цалин/.test(pn) && /цалин/.test(tn)) score = Math.max(score, 90);
    if (/лаборатор.*гал|гал.*лаборатор/.test(pn) && /хабэа|гал/.test(tn)) {
      score = Math.max(score, 80);
    }
    if (/лаборатор.*гал|гал.*лаборатор/.test(pn) && /лаборатор|хими/.test(tn)) {
      score = Math.max(score, 78);
    }
    return { org: c.org, title: c.title, score };
  });
  for (const s of scored) bestScore = Math.max(bestScore, s.score);
  // Stricter threshold — avoid weak cross-org fuzzy hits
  if (bestScore < 72) return [];

  // Keep only top-score title(s); same Excel title may sit on multiple albas
  // (e.g. өрөмдлөг → зүүн+баруун).
  const topTitles = new Set(
    scored.filter((s) => s.score >= bestScore - 0.5).map((s) => s.title),
  );
  const orgs: Array<{ type: "heltes" | "alba"; id: string }> = [];
  const seen = new Set<string>();
  for (const s of scored) {
    if (s.score < bestScore - 0.5) continue;
    if (!topTitles.has(s.title)) continue;
    const key = `${s.org.type}:${s.org.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    orgs.push(s.org);
  }
  return orgs;
}

/**
 * Keep responsibility links only when the position's unit matches the
 * policy's Excel-mapped алба/хэлтэс. Deactivates cross-org BGS noise.
 */
function scopeResponsibilityLinksToPolicyOrg(
  db: {
    policy_clauses: Array<{ id: string; policy_id: string; is_deleted: boolean }>;
    clause_position_responsibilities: Array<{
      policy_clause_id: string;
      job_position_id: string;
      is_active: boolean;
    }>;
  },
  heltes: RefHeltes[],
  position_to_alba: Record<string, string>,
  policy_to_org: Record<string, Array<{ type: "heltes" | "alba"; id: string }>>,
): { kept: number; deactivated: number } {
  const albaById = new Map<string, RefAlba>();
  for (const h of heltes) for (const a of h.albas) albaById.set(a.id, a);

  const clauseToPolicy = new Map(
    db.policy_clauses.filter((c) => !c.is_deleted).map((c) => [c.id, c.policy_id]),
  );

  let kept = 0;
  let deactivated = 0;

  for (const link of db.clause_position_responsibilities) {
    if (!link.is_active) continue;
    const policyId = clauseToPolicy.get(link.policy_clause_id);
    if (!policyId) continue;
    const orgs = policy_to_org[policyId];
    if (!orgs?.length) {
      // Unmapped policy — leave BGS links as-is
      kept++;
      continue;
    }

    const posAlbaId = position_to_alba[link.job_position_id];
    if (!posAlbaId) {
      // Position in Бусад — drop scoped policy links
      link.is_active = false;
      deactivated++;
      continue;
    }
    const posAlba = albaById.get(posAlbaId);
    if (!posAlba) {
      link.is_active = false;
      deactivated++;
      continue;
    }

    const albaIds = orgs.filter((o) => o.type === "alba").map((o) => o.id);
    const heltesIds = new Set<string>();
    for (const o of orgs) {
      if (o.type === "heltes") heltesIds.add(o.id);
      else {
        const a = albaById.get(o.id);
        if (a) heltesIds.add(a.heltes_id);
      }
    }

    let ok = false;
    if (albaIds.length) {
      // Alba-scoped policy: position must belong to one of those albas
      ok = albaIds.includes(posAlbaId);
    } else {
      // Heltes-scoped only: any alba under that heltes
      ok = heltesIds.has(posAlba.heltes_id);
    }

    if (ok) kept++;
    else {
      link.is_active = false;
      deactivated++;
    }
  }

  return { kept, deactivated };
}

async function main() {
  const wb = XLSX.readFile(XLSX_PATH);
  const { heltes, albaByCode } = parseJobSheet(wb);
  parsePolicySheet(wb, heltes, albaByCode);

  const catalog: OrgCatalog = {
    source: XLSX_PATH,
    built_at: new Date().toISOString(),
    heltes,
    other: { id: "other", name: "Бусад" },
  };

  await fs.mkdir(path.dirname(CATALOG_PATH), { recursive: true });
  await fs.writeFile(CATALOG_PATH, JSON.stringify(catalog, null, 2), "utf8");

  const db = JSON.parse(await fs.readFile(DB_PATH, "utf8")) as {
    job_positions: Array<{
      id: string;
      bteg_id: string | null;
      name: string;
      is_active: boolean;
      heltes_id: string | null;
      alba_id: string | null;
      heltes_name: string | null;
      alba_name: string | null;
      organization_id?: string | null;
      gazar_id?: string | null;
      org_unit_id?: string | null;
      description?: string | null;
      created_at?: string;
      updated_at?: string;
    }>;
    policies: Array<{ id: string; name: string; is_deleted: boolean }>;
    policy_clauses: Array<{ id: string; policy_id: string; is_deleted: boolean }>;
    clause_position_responsibilities: Array<{
      id: string;
      job_position_id: string;
      policy_clause_id: string;
      responsibility_type: string;
      is_active: boolean;
    }>;
    compliance_evaluations: Array<{ job_position_id: string }>;
    job_descriptions: Array<{ job_position_id: string }>;
  };

  const positionCandidates: Array<{
    albaId: string;
    albaName: string;
    heltesName: string;
    code: string;
  }> = [];
  for (const h of heltes) {
    for (const a of h.albas) {
      for (const code of a.position_codes) {
        positionCandidates.push({
          albaId: a.id,
          albaName: a.name,
          heltesName: h.name,
          code,
        });
      }
    }
  }

  const policyCandidates: Array<{
    org: { type: "heltes" | "alba"; id: string };
    title: string;
  }> = [];
  for (const h of heltes) {
    for (const t of h.policy_titles) {
      policyCandidates.push({ org: { type: "heltes", id: h.id }, title: t });
    }
    for (const a of h.albas) {
      for (const t of a.policy_titles) {
        policyCandidates.push({ org: { type: "alba", id: a.id }, title: t });
      }
    }
  }

  const albaById = new Map<string, RefAlba>();
  const heltesById = new Map(heltes.map((h) => [h.id, h]));
  for (const h of heltes) for (const a of h.albas) albaById.set(a.id, a);

  const matches: Record<string, { albaId: string; code: string; score: number }> =
    {};

  for (const p of db.job_positions.filter((x) => x.is_active)) {
    const hit = bestPositionMatch(p, positionCandidates);
    if (hit) {
      matches[p.id] = hit;
      const alba = albaById.get(hit.albaId);
      const heltesRef = alba ? heltesById.get(alba.heltes_id) : undefined;
      p.alba_name = alba?.name ?? p.alba_name;
      p.heltes_name = heltesRef?.name ?? p.heltes_name;
    }
  }

  const position_to_alba = canonicalizeAlbaPositions(db, heltes, matches);

  const unmatched_positions: Array<{ id: string; name: string }> = [];
  for (const p of db.job_positions.filter((x) => x.is_active)) {
    if (position_to_alba[p.id]) continue;
    unmatched_positions.push({ id: p.id, name: p.name });
    p.heltes_name = "Бусад";
    p.alba_name = "Бусад";
  }

  // Refresh names for mapped positions
  for (const [pid, albaId] of Object.entries(position_to_alba)) {
    const p = db.job_positions.find((x) => x.id === pid);
    const alba = albaById.get(albaId);
    const heltesRef = alba ? heltesById.get(alba.heltes_id) : undefined;
    if (p && alba) {
      p.alba_name = alba.name;
      p.heltes_name = heltesRef?.name ?? p.heltes_name;
    }
  }

  const policy_to_org: Record<
    string,
    Array<{ type: "heltes" | "alba"; id: string }>
  > = {};
  const unmatched_policies: Array<{ id: string; name: string }> = [];
  for (const pol of db.policies.filter((p) => !p.is_deleted)) {
    const orgs = bestPolicyMatches(pol.name, policyCandidates);
    if (orgs.length) policy_to_org[pol.id] = orgs;
    else unmatched_policies.push({ id: pol.id, name: pol.name });
  }

  // Keep ALL responsibility links active so evaluations / matrix / org
  // flows stay usable. (Previous cross-org scoping deactivated ~half.)
  for (const link of db.clause_position_responsibilities) {
    link.is_active = true;
  }
  const activeLinks = db.clause_position_responsibilities.filter((l) => l.is_active)
    .length;

  // Apply manual UI overrides (policy ↔ хэлтэс/алба) so rebuild keeps user edits
  const overridesPath = path.join(ROOT, "data", "local", "policy-org-overrides.json");
  try {
    const overrides = JSON.parse(await fs.readFile(overridesPath, "utf8")) as Record<
      string,
      { orgs: Array<{ type: "heltes" | "alba"; id: string }> | null; policy_name?: string }
    >;
    for (const [policyId, ov] of Object.entries(overrides)) {
      if (ov.orgs == null) {
        delete policy_to_org[policyId];
        if (!unmatched_policies.some((p) => p.id === policyId)) {
          unmatched_policies.push({
            id: policyId,
            name: ov.policy_name ?? policyId,
          });
        }
      } else {
        policy_to_org[policyId] = ov.orgs;
        const idx = unmatched_policies.findIndex((p) => p.id === policyId);
        if (idx >= 0) unmatched_policies.splice(idx, 1);
      }
    }
    console.log(`Applied ${Object.keys(overrides).length} policy-org overrides`);
  } catch {
    // no overrides file
  }

  const positionOverridesPath = path.join(
    ROOT,
    "data",
    "local",
    "position-org-overrides.json",
  );
  try {
    const pov = JSON.parse(await fs.readFile(positionOverridesPath, "utf8")) as Record<
      string,
      { heltes_id: string; alba_id: string; position_name?: string }
    >;
    for (const [positionId, ov] of Object.entries(pov)) {
      if (ov.heltes_id === "other" || ov.alba_id === "alba:other") {
        delete position_to_alba[positionId];
        if (!unmatched_positions.some((p) => p.id === positionId)) {
          unmatched_positions.push({
            id: positionId,
            name: ov.position_name ?? positionId,
          });
        }
      } else {
        position_to_alba[positionId] = ov.alba_id;
        const idx = unmatched_positions.findIndex((p) => p.id === positionId);
        if (idx >= 0) unmatched_positions.splice(idx, 1);
      }
      const pos = db.job_positions.find((p) => p.id === positionId);
      if (pos) {
        const heltesRef = heltes.find((h) => h.id === ov.heltes_id);
        const alba = heltesRef?.albas.find((a) => a.id === ov.alba_id);
        if (heltesRef && alba) {
          pos.heltes_name = heltesRef.name;
          pos.alba_name = alba.name;
        } else if (ov.heltes_id === "other") {
          pos.heltes_name = "Бусад";
          pos.alba_name = "Бусад";
        }
      }
    }
    console.log(`Applied ${Object.keys(pov).length} position-org overrides`);
  } catch {
    // no position overrides
  }

  const map: ReferenceMap = {
    built_at: new Date().toISOString(),
    position_to_alba,
    policy_to_org,
    unmatched_positions,
    unmatched_policies,
    stats: {
      heltes: heltes.length,
      albas: heltes.reduce((s, h) => s + h.albas.length, 0),
      catalog_positions: positionCandidates.length,
      catalog_policies: policyCandidates.length,
      matched_positions: Object.keys(position_to_alba).length,
      unmatched_positions: unmatched_positions.length,
      matched_policies: Object.keys(policy_to_org).length,
      unmatched_policies: unmatched_policies.length,
      responsibility_links_kept: activeLinks,
      responsibility_links_deactivated: 0,
      responsibility_links_active: activeLinks,
    },
  };

  await fs.mkdir(path.dirname(MAP_PATH), { recursive: true });
  await fs.writeFile(MAP_PATH, JSON.stringify(map, null, 2), "utf8");
  await fs.writeFile(DB_PATH, JSON.stringify(db), "utf8");

  console.log("Catalog written:", CATALOG_PATH);
  console.log("Map written:", MAP_PATH);
  console.log(JSON.stringify(map.stats, null, 2));
  console.log(`Responsibility links active: ${activeLinks}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
