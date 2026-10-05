import { loadAppDataPayload } from "@/lib/risk/store-payload";
import type { GlossaryTerm } from "@/lib/glossary/types";
import { collectMnLetters } from "@/lib/glossary/terms";

type Policy = {
  id: string;
  name?: string | null;
  reference_code?: string | null;
  is_deleted?: boolean;
};

type Clause = {
  id: string;
  policy_id: string;
  reference_number?: string | null;
  text?: string | null;
  is_deleted?: boolean;
};

type PolicyDb = { policies?: Policy[]; policy_clauses?: Clause[] };

export type GlossaryOverviewInsight = {
  termCount: number;
  withAbbr: number;
  withDefinition: number;
  letterCount: number;
  letterBars: Array<{ letter: string; count: number }>;
  coveragePct: number;
};

export type GlossaryHomonymInsight = {
  key: string;
  kind: "mn" | "en";
  label: string;
  count: number;
  terms: Array<{ id: string; mn: string; en: string; definition: string }>;
};

export type GlossarySourceHit = {
  policyId: string;
  policyName: string;
  referenceCode: string;
  hitCount: number;
  sampleTerms: string[];
};

export type GlossaryUsageBucket = {
  level: number;
  label: string;
  count: number;
  terms: Array<{ id: string; mn: string; en: string; hits: number }>;
};

export type GlossaryInsights = {
  overview: GlossaryOverviewInsight;
  homonyms: GlossaryHomonymInsight[];
  sourceDocuments: GlossarySourceHit[];
  usageLevels: GlossaryUsageBucket[];
  searchedAt: string;
  platformSearchNote: string;
};

function normalize(text: string) {
  return text.trim().toLowerCase();
}

function buildHomonyms(terms: GlossaryTerm[]): GlossaryHomonymInsight[] {
  const byMn = new Map<string, GlossaryTerm[]>();
  const byEn = new Map<string, GlossaryTerm[]>();

  for (const term of terms) {
    const mn = normalize(term.mn);
    const en = normalize(term.en);
    if (mn) {
      const list = byMn.get(mn) ?? [];
      list.push(term);
      byMn.set(mn, list);
    }
    if (en) {
      const list = byEn.get(en) ?? [];
      list.push(term);
      byEn.set(en, list);
    }
  }

  const result: GlossaryHomonymInsight[] = [];
  for (const [key, list] of byMn) {
    const defs = new Set(list.map((t) => normalize(t.definition)));
    if (list.length > 1 && defs.size > 1) {
      result.push({
        key: `mn:${key}`,
        kind: "mn",
        label: list[0].mn,
        count: list.length,
        terms: list.map((t) => ({
          id: t.id,
          mn: t.mn,
          en: t.en,
          definition: t.definition,
        })),
      });
    }
  }
  for (const [key, list] of byEn) {
    const defs = new Set(list.map((t) => normalize(t.definition)));
    if (list.length > 1 && defs.size > 1) {
      result.push({
        key: `en:${key}`,
        kind: "en",
        label: list[0].en,
        count: list.length,
        terms: list.map((t) => ({
          id: t.id,
          mn: t.mn,
          en: t.en,
          definition: t.definition,
        })),
      });
    }
  }

  return result.sort((a, b) => b.count - a.count).slice(0, 40);
}

async function searchPolicies(terms: GlossaryTerm[]) {
  const db = await loadAppDataPayload<PolicyDb>("policy_compliance_db");
  const policies = (db?.policies ?? []).filter((p) => !p.is_deleted);
  const clauses = (db?.policy_clauses ?? []).filter((c) => !c.is_deleted);
  if (!policies.length) {
    return {
      hits: [] as GlossarySourceHit[],
      termHits: new Map<string, number>(),
      note: "Журмын сан (policy_compliance_db) олдсонгүй — зөвхөн толийн дотоод шинжилгээ харуулж байна.",
    };
  }

  const policyName = new Map(
    policies.map((p) => [
      p.id,
      {
        name: p.name?.trim() || "Нэргүй журам",
        code: p.reference_code?.trim() || "",
      },
    ]),
  );

  const searchable = terms
    .map((term) => {
      const needles = [term.mn, term.en, term.abbr]
        .map((v) => v.trim().toLowerCase())
        .filter((v) => v.length >= 4);
      return { term, needles };
    })
    .filter((row) => row.needles.length > 0)
    .slice(0, 250);

  const byPolicy = new Map<
    string,
    { hitCount: number; terms: Set<string> }
  >();
  const termHits = new Map<string, number>();

  const clauseLimit = Math.min(clauses.length, 2_500);
  for (let i = 0; i < clauseLimit; i += 1) {
    const clause = clauses[i];
    const text = `${clause.reference_number ?? ""} ${clause.text ?? ""}`.toLowerCase();
    if (text.length < 4) continue;
    for (const row of searchable) {
      let matched = false;
      for (const needle of row.needles) {
        if (text.includes(needle)) {
          matched = true;
          break;
        }
      }
      if (!matched) continue;
      termHits.set(row.term.id, (termHits.get(row.term.id) ?? 0) + 1);
      const bucket = byPolicy.get(clause.policy_id) ?? {
        hitCount: 0,
        terms: new Set<string>(),
      };
      bucket.hitCount += 1;
      bucket.terms.add(row.term.mn || row.term.en || row.term.abbr);
      byPolicy.set(clause.policy_id, bucket);
    }
  }

  const hits: GlossarySourceHit[] = [...byPolicy.entries()]
    .map(([policyId, bucket]) => {
      const meta = policyName.get(policyId);
      return {
        policyId,
        policyName: meta?.name ?? policyId,
        referenceCode: meta?.code ?? "",
        hitCount: bucket.hitCount,
        sampleTerms: [...bucket.terms].slice(0, 6),
      };
    })
    .sort((a, b) => b.hitCount - a.hitCount)
    .slice(0, 20);

  return {
    hits,
    termHits,
    note: `Журмын ${policies.length} баримт, ${clauseLimit} заалт дунд толийн нэршлээр хайлаа.`,
  };
}

function buildUsageLevels(
  terms: GlossaryTerm[],
  termHits: Map<string, number>,
): GlossaryUsageBucket[] {
  const rows = terms.map((term) => ({
    id: term.id,
    mn: term.mn,
    en: term.en,
    hits: termHits.get(term.id) ?? 0,
  }));

  const buckets: GlossaryUsageBucket[] = [
    { level: 1, label: "Идэвхтэй (5+)", count: 0, terms: [] },
    { level: 2, label: "Дунд (2–4)", count: 0, terms: [] },
    { level: 3, label: "Бага (1)", count: 0, terms: [] },
    { level: 4, label: "Олдсонгүй (0)", count: 0, terms: [] },
  ];

  for (const row of rows) {
    const bucket =
      row.hits >= 5
        ? buckets[0]
        : row.hits >= 2
          ? buckets[1]
          : row.hits === 1
            ? buckets[2]
            : buckets[3];
    bucket.count += 1;
    if (bucket.terms.length < 8) bucket.terms.push(row);
  }

  for (const bucket of buckets) {
    bucket.terms.sort((a, b) => b.hits - a.hits);
  }
  return buckets;
}

export async function buildGlossaryInsights(
  terms: GlossaryTerm[],
): Promise<GlossaryInsights> {
  const letters = collectMnLetters(terms);
  const letterBars = letters.map((letter) => ({
    letter,
    count: terms.filter((term) => {
      const mn = term.mn.trim().charAt(0).toLocaleUpperCase("mn-MN");
      const abbr = term.abbr.trim().charAt(0).toLocaleUpperCase("mn-MN");
      return mn === letter || abbr === letter;
    }).length,
  }));

  const withAbbr = terms.filter((t) => t.abbr.trim()).length;
  const withDefinition = terms.filter((t) => t.definition.trim()).length;
  const coveragePct = terms.length
    ? Math.round((withDefinition / terms.length) * 100)
    : 0;

  const homonyms = buildHomonyms(terms);
  const policySearch = await searchPolicies(terms);
  const usageLevels = buildUsageLevels(terms, policySearch.termHits);

  return {
    overview: {
      termCount: terms.length,
      withAbbr,
      withDefinition,
      letterCount: letters.length,
      letterBars,
      coveragePct,
    },
    homonyms,
    sourceDocuments: policySearch.hits,
    usageLevels,
    searchedAt: new Date().toISOString(),
    platformSearchNote: policySearch.note,
  };
}
