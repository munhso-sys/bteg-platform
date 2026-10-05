import rawItems from "@/data/glossary-terms.json";
import type {
  GlossaryDb,
  GlossaryLetterGroup,
  GlossaryOverrides,
  GlossaryTerm,
} from "@/lib/glossary/types";
import { MN_ALPHABET } from "@/lib/glossary/types";

type SeedRow =
  | { type: "section"; letter: string }
  | {
      type: "term";
      id: string;
      abbr: string;
      en: string;
      mn: string;
      definition: string;
    };

const SEED_ITEMS = rawItems as SeedRow[];

export const SEED_TERMS: GlossaryTerm[] = SEED_ITEMS.filter(
  (item): item is Extract<SeedRow, { type: "term" }> => item.type === "term",
).map((term) => ({
  id: term.id,
  abbr: term.abbr,
  en: term.en,
  mn: term.mn,
  definition: term.definition,
  source: "seed" as const,
}));

export function mergeTerm(
  base: GlossaryTerm,
  overrides: GlossaryOverrides,
): GlossaryTerm {
  const patch = overrides[base.id];
  if (!patch) return base;
  return {
    ...base,
    abbr: patch.abbr ?? base.abbr,
    en: patch.en ?? base.en,
    mn: patch.mn ?? base.mn,
    definition: patch.definition ?? base.definition,
  };
}

export function resolveGlossaryTerms(db: GlossaryDb): GlossaryTerm[] {
  const seed = SEED_TERMS.map((term) => mergeTerm(term, db.overrides));
  const custom = db.customTerms.map((term) =>
    mergeTerm({ ...term, source: "custom" }, db.overrides),
  );
  return [...seed, ...custom];
}

/** First letter from Mongolian word or abbreviation (Cyrillic preferred). */
export function termIndexLetter(term: GlossaryTerm): string | null {
  const candidates = [term.mn, term.abbr]
    .map((value) => value.trim())
    .filter(Boolean);
  for (const value of candidates) {
    const ch = value.charAt(0).toLocaleUpperCase("mn-MN");
    if (/[А-ЯЁӨҮа-яёөү]/.test(ch)) return ch.toLocaleUpperCase("mn-MN");
  }
  return null;
}

export function collectMnLetters(terms: GlossaryTerm[]): string[] {
  const set = new Set<string>();
  for (const term of terms) {
    const letter = termIndexLetter(term);
    if (letter) set.add(letter);
  }
  const order = new Map(MN_ALPHABET.map((letter, index) => [letter, index]));
  return [...set].sort((a, b) => {
    const ai = order.get(a as (typeof MN_ALPHABET)[number]);
    const bi = order.get(b as (typeof MN_ALPHABET)[number]);
    if (ai != null && bi != null) return ai - bi;
    if (ai != null) return -1;
    if (bi != null) return 1;
    return a.localeCompare(b, "mn");
  });
}

export function groupByMnLetter(terms: GlossaryTerm[]): GlossaryLetterGroup[] {
  const map = new Map<string, GlossaryTerm[]>();
  for (const term of terms) {
    const letter = termIndexLetter(term) ?? "#";
    const bucket = map.get(letter) ?? [];
    bucket.push(term);
    map.set(letter, bucket);
  }

  const letters = collectMnLetters(terms);
  if (map.has("#")) letters.push("#");

  return letters.map((letter) => ({
    letter,
    terms: (map.get(letter) ?? []).slice().sort((a, b) =>
      (a.mn || a.en).localeCompare(b.mn || b.en, "mn"),
    ),
  }));
}

export function searchGlossaryTerms(
  terms: GlossaryTerm[],
  query: string,
): GlossaryTerm[] {
  const q = query.trim().toLowerCase();
  if (!q) return terms;
  return terms.filter((term) => {
    const haystack = [term.abbr, term.en, term.mn, term.definition]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function nextCustomTermId(existing: GlossaryTerm[]): string {
  const nums = existing
    .map((term) => {
      const match = /^custom-(\d+)$/.exec(term.id);
      return match ? Number(match[1]) : 0;
    })
    .filter((n) => Number.isFinite(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `custom-${String(next).padStart(4, "0")}`;
}
