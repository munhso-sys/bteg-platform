export type GlossaryTerm = {
  id: string;
  abbr: string;
  en: string;
  mn: string;
  definition: string;
  /** Seed terms come from JSON; custom terms are user-added. */
  source?: "seed" | "custom";
};

export type GlossaryTermOverride = {
  abbr?: string;
  en?: string;
  mn?: string;
  definition?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type GlossaryOverrides = Record<string, GlossaryTermOverride>;

export type GlossaryHomonym = {
  id: string;
  term: string;
  note: string;
};

export type GlossarySourceDocument = {
  id: string;
  no: number;
  name: string;
};

export type GlossaryUsageLevel = {
  id: string;
  level: number;
  description: string;
};

export type GlossaryMeta = {
  title: string;
  structureNote: string;
  homonymsTitle: string;
  homonymsNote: string;
  homonyms: GlossaryHomonym[];
  sourceDocumentsTitle: string;
  sourceDocuments: GlossarySourceDocument[];
  usageLevelsTitle: string;
  usageLevels: GlossaryUsageLevel[];
  updatedAt?: string;
};

export type GlossaryDb = {
  overrides: GlossaryOverrides;
  customTerms: GlossaryTerm[];
  meta: GlossaryMeta;
  updatedAt?: string;
};

export type GlossaryLetterGroup = {
  letter: string;
  terms: GlossaryTerm[];
};

/** Mongolian Cyrillic alphabet order for letter index. */
export const MN_ALPHABET = [
  "А",
  "Б",
  "В",
  "Г",
  "Д",
  "Е",
  "Ё",
  "Ж",
  "З",
  "И",
  "Й",
  "К",
  "Л",
  "М",
  "Н",
  "О",
  "Ө",
  "П",
  "Р",
  "С",
  "Т",
  "У",
  "Ү",
  "Ф",
  "Х",
  "Ц",
  "Ч",
  "Ш",
  "Щ",
  "Ъ",
  "Ы",
  "Ь",
  "Э",
  "Ю",
  "Я",
] as const;
