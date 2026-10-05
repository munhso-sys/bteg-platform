/** Shared (client-safe) org assignment types — no Node/fs imports. */

export const DIRECT_ALBA_ID = "_direct";
export const OTHER_HELTES_ID = "other";
export const OTHER_ALBA_ID = "alba:other";

/** Байгууллага → Бүгд → Байгууллагын бүх албан тушаал */
export const COMPANY_HELTES_ID = "company";
export const COMPANY_ALBA_ID = "company:all";
/** Хэлтэс dropdown дахь «Бүгд» хавтас */
export const COMPANY_FOLDER_LABEL = "Бүгд";
/** Байгууллагын нийт ажлын байрны хамрах хүрээ */
export const COMPANY_SCOPE_LABEL = "Байгууллагын бүх албан тушаал";

/** Байгууллага → Хэлтэс → Хэлтэсийн бүх албан тушаал */
export const HELTES_COMMON_LABEL = "Хэлтэсийн бүх албан тушаал";
export const HELTES_COMMON_SUFFIX = "::heltes-common";

/** Байгууллага → Хэлтэс → Алба → Албаны бүх албан тушаал */
export const ALBA_COMMON_LABEL = "Албаны бүх албан тушаал";
/** Form synthetic: link every position under the selected alba */
export const SCOPE_ALL_POSITIONS_ID = "__scope_all_positions__";

export function heltesCommonId(heltesId: string) {
  return `${heltesId}${HELTES_COMMON_SUFFIX}`;
}

export function isHeltesCommonId(id: string) {
  return id.endsWith(HELTES_COMMON_SUFFIX);
}

export function parseHeltesCommonId(id: string): string | null {
  if (!isHeltesCommonId(id)) return null;
  return id.slice(0, -HELTES_COMMON_SUFFIX.length);
}

export function isCompanyScope(heltesId: string, albaId?: string) {
  return (
    heltesId === COMPANY_HELTES_ID ||
    albaId === COMPANY_ALBA_ID
  );
}

export function isSyntheticOrgScopeId(id: string) {
  return (
    id === COMPANY_ALBA_ID ||
    id === OTHER_ALBA_ID ||
    id === SCOPE_ALL_POSITIONS_ID ||
    isHeltesCommonId(id)
  );
}

/** Breadcrumb path for scope pickers ({байгууллага} → …). */
export function orgScopePath(
  organizationName: string | null | undefined,
  parts: string[],
) {
  const org = (organizationName ?? "").trim() || "Байгууллага";
  return [org, ...parts.filter(Boolean)].join(" → ");
}

/** Stored on responsibility.notes when bulk-linking a scope. */
export const SCOPE_NOTE_PREFIX = "scope:";

/** Synthetic evaluate-dropdown id prefix for scope-wide scoring. */
export const SCOPE_EVAL_PREFIX = "__scope_eval__:";

export function companyScopeNote() {
  return `${SCOPE_NOTE_PREFIX}company:all`;
}

export function heltesScopeNote(heltesId: string) {
  return `${SCOPE_NOTE_PREFIX}heltes:${heltesId}`;
}

export function albaScopeNote(albaId: string) {
  return `${SCOPE_NOTE_PREFIX}alba:${albaId}`;
}

export function parseScopeNote(
  notes: string | null | undefined,
): null | { kind: "company" } | { kind: "heltes"; id: string } | { kind: "alba"; id: string } {
  const raw = (notes ?? "").trim();
  if (!raw.startsWith(SCOPE_NOTE_PREFIX)) return null;
  const body = raw.slice(SCOPE_NOTE_PREFIX.length);
  if (body === "company:all" || body.startsWith("company:")) {
    return { kind: "company" };
  }
  if (body.startsWith("heltes:")) {
    return { kind: "heltes", id: body.slice("heltes:".length) };
  }
  if (body.startsWith("alba:")) {
    return { kind: "alba", id: body.slice("alba:".length) };
  }
  return null;
}

export function scopeNoteLabel(
  notes: string | null | undefined,
  names?: { heltes?: string; alba?: string; organization?: string },
): string | null {
  const parsed = parseScopeNote(notes);
  if (!parsed) return null;
  if (parsed.kind === "company") {
    const org = (names?.organization ?? "").trim();
    return org ? `${org} · ${COMPANY_SCOPE_LABEL}` : COMPANY_SCOPE_LABEL;
  }
  if (parsed.kind === "heltes") {
    return names?.heltes
      ? `${names.heltes} · ${HELTES_COMMON_LABEL}`
      : HELTES_COMMON_LABEL;
  }
  return names?.alba
    ? `${names.alba} · ${ALBA_COMMON_LABEL}`
    : ALBA_COMMON_LABEL;
}

export type OrgAssignTree = {
  heltes: Array<{
    id: string;
    name: string;
    albas: Array<{ id: string; name: string }>;
  }>;
  other: { id: string; name: string };
  /** Majority / linked employer name from job positions (not hardcoded). */
  organizationName?: string | null;
};

export type PositionListRow = {
  id: string;
  name: string;
  bteg_id: string | null;
  official_code: string | null;
  organization_name: string;
  heltesId: string;
  albaId: string;
  heltes: string;
  alba: string;
  has_job_description: boolean;
  link_count: number;
};

/** Read-only review list metrics (Шалгах subpage). */
export type PositionReviewRow = PositionListRow & {
  /** Ж-үнэлгээ — personal link evaluations average */
  policy_avg_score: number | null;
  /** Холбогдсон журмын тоо — unique policies via active personal links */
  policy_count: number;
  /** Заалтын тоо — unique clauses via active personal links */
  clause_count: number;
  /** Т-үнэлгээ — АБТ үнэлгээний сүүлийн оноо (0–100) */
  description_score: number | null;
};

export function orgPath(heltesId: string, albaId?: string, rest?: string) {
  const base = `/org/heltes/${encodeURIComponent(heltesId)}`;
  if (!albaId) return base;
  const alba = `${base}/alba/${encodeURIComponent(albaId)}`;
  return rest ? `${alba}/${rest}` : alba;
}

/** Client-safe tree for /org Collapse·Expand explorer. */
export type OrgExplorerHeltes = {
  heltesId: string;
  heltesName: string;
  albaCount: number;
  positionCount: number;
  policyCount: number;
  avgScore: number | null;
  albas: Array<{
    albaId: string;
    albaName: string;
    positionCount: number;
    policyCount: number;
    avgScore: number | null;
    isDirect: boolean;
  }>;
};
