import { loadAppDataPayload } from "@/lib/risk/store-payload";
import { matchesUnitText, type UnitScope } from "@/lib/rbac/unit-scope";
import type { AiResolvedScope } from "@/lib/ai/resolve-scope";

const STOP_WORDS = new Set([
  "юу",
  "вэ",
  "нь",
  "ба",
  "бэ",
  "юуны",
  "тухай",
  "хэлнэ",
  "үү",
  "уу",
  "гэж",
  "байгаа",
  "байх",
  "хэдэн",
  "хэд",
  "ямар",
  "хэрхэн",
  "мөн",
  "энэ",
  "тэр",
  "ийн",
  "ыг",
  "ийг",
  "тай",
  "той",
  "дээ",
  "дээр",
  "дотор",
  "асуух",
  "хэлэх",
  "өг",
  "please",
  "the",
  "and",
  "for",
  "what",
  "how",
  "many",
]);

const MAX_POLICY_HITS = 8;
const MAX_INSPECTION_HITS = 8;
const CLAUSE_TEXT_MAX = 420;
const FINDING_TEXT_MAX = 280;

type Policy = {
  id: string;
  name?: string | null;
  reference_code?: string | null;
  is_deleted?: boolean;
  status?: string | null;
};

type Clause = {
  id: string;
  policy_id: string;
  reference_number?: string | null;
  text?: string | null;
  is_deleted?: boolean;
};

type PolicyOrgOverride = {
  orgs: Array<{ type: "heltes" | "alba"; id: string }> | null;
};

type PolicyOrgOverridesFile = Record<string, PolicyOrgOverride>;

type Finding = {
  id: string;
  runId?: string;
  title?: string;
  description?: string;
  sourceText?: string;
  status?: string;
  severity?: string;
  findingType?: string;
};

type Run = {
  id: string;
  inspectedByOrg?: string;
  inspectionType?: string;
};

function trimText(value: string, max: number) {
  const t = value.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Tokenize user question for lightweight keyword retrieval (MN + Latin). */
export function tokenizeAiQuery(query: string): string[] {
  const raw = query
    .toLocaleLowerCase("mn")
    .replace(/[^\p{L}\p{N}\s.-]/gu, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));

  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of raw) {
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 12) break;
  }
  return out;
}

function scoreText(haystack: string, tokens: string[]): number {
  if (!tokens.length || !haystack) return 0;
  const h = haystack.toLocaleLowerCase("mn");
  let score = 0;
  for (const t of tokens) {
    if (h.includes(t)) {
      score += t.length >= 5 ? 3 : 2;
      if (h.startsWith(t) || h.includes(` ${t}`)) score += 1;
    }
  }
  return score;
}

function policyMatchesUnit(
  policyId: string,
  overrides: PolicyOrgOverridesFile,
  scope: UnitScope,
): boolean {
  if (!scope.active) return true;
  const ov = overrides[policyId];
  if (!ov || ov.orgs == null) return false;
  return ov.orgs.some((org) => {
    if (org.type === "heltes" && scope.heltesId && org.id === scope.heltesId) {
      return true;
    }
    if (org.type === "alba" && scope.albaId && org.id === scope.albaId) {
      return true;
    }
    return false;
  });
}

/**
 * Phase-1 retrieval: keyword match over mirrored store (not full dump).
 * Respects unit scope; returns truncated excerpts only.
 */
export async function retrievePolicyContent(
  scope: AiResolvedScope,
  query: string,
): Promise<string[]> {
  if (scope.mode === "none") return [];
  const tokens = tokenizeAiQuery(query);
  if (tokens.length === 0) return [];

  const [db, overrides] = await Promise.all([
    loadAppDataPayload<{
      policies?: Policy[];
      policy_clauses?: Clause[];
    }>("policy_compliance_db"),
    loadAppDataPayload<PolicyOrgOverridesFile>(
      "policy_compliance_policy_org_overrides",
    ),
  ]);
  if (!db) return [];

  const ov = overrides ?? {};
  let policies = (db.policies ?? []).filter((p) => !p.is_deleted);
  if (scope.unitScope.active) {
    const scoped = policies.filter((p) =>
      policyMatchesUnit(p.id, ov, scope.unitScope),
    );
    if (scoped.length > 0) policies = scoped;
  }
  const policyById = new Map(policies.map((p) => [p.id, p]));
  const clauses = (db.policy_clauses ?? []).filter(
    (c) => !c.is_deleted && policyById.has(c.policy_id),
  );

  type Hit = { score: number; line: string };
  const hits: Hit[] = [];

  for (const p of policies) {
    const label = `${p.reference_code ?? ""} ${p.name ?? ""}`;
    const s = scoreText(label, tokens);
    if (s <= 0) continue;
    hits.push({
      score: s + 4,
      line: `Журам: ${trimText(`${p.reference_code ?? "—"} · ${p.name ?? p.id}`, 160)}`,
    });
  }

  for (const c of clauses) {
    const policy = policyById.get(c.policy_id);
    const blob = `${c.reference_number ?? ""} ${c.text ?? ""} ${policy?.name ?? ""} ${policy?.reference_code ?? ""}`;
    const s = scoreText(blob, tokens);
    if (s <= 0) continue;
    const text = (c.text ?? "").trim();
    if (!text) continue;
    hits.push({
      score: s,
      line: `Заалт ${c.reference_number || "—"} (${policy?.reference_code || policy?.name || "журам"}): ${trimText(text, CLAUSE_TEXT_MAX)}`,
    });
  }

  hits.sort((a, b) => b.score - a.score);
  const lines = hits.slice(0, MAX_POLICY_HITS).map((h) => h.line);
  if (lines.length) {
    lines.unshift(
      `Журмын агуулгын хэсэг (хайлт · дээд тал ${MAX_POLICY_HITS}, эрх: ${scope.scopeNote}):`,
    );
  }
  return lines;
}

export async function retrieveInspectionDetail(
  scope: AiResolvedScope,
  query: string,
): Promise<string[]> {
  if (scope.mode === "none") return [];
  const tokens = tokenizeAiQuery(query);
  if (tokens.length === 0) return [];

  const store = await loadAppDataPayload<{
    findings?: Finding[];
    runs?: Run[];
  }>("inspection_center_store");
  if (!store) return [];

  let runs = store.runs ?? [];
  if (scope.unitScope.active) {
    runs = runs.filter((r) =>
      matchesUnitText(r.inspectedByOrg, scope.unitScope),
    );
  }
  const runById = new Map(runs.map((r) => [r.id, r]));

  let findings = store.findings ?? [];
  if (scope.unitScope.active) {
    findings = findings.filter((f) => f.runId && runById.has(f.runId));
  }

  type Hit = { score: number; line: string };
  const hits: Hit[] = [];

  for (const f of findings) {
    const run = f.runId ? runById.get(f.runId) : undefined;
    const blob = [
      f.title,
      f.description,
      f.sourceText,
      f.status,
      f.severity,
      f.findingType,
      run?.inspectedByOrg,
      run?.inspectionType,
    ]
      .filter(Boolean)
      .join(" ");
    const s = scoreText(blob, tokens);
    if (s <= 0) continue;
    const body = trimText(
      [f.title, f.description || f.sourceText].filter(Boolean).join(" — ") ||
        f.id,
      FINDING_TEXT_MAX,
    );
    const meta = [
      f.status || "—",
      f.severity || null,
      run?.inspectedByOrg || null,
    ]
      .filter(Boolean)
      .join(" · ");
    hits.push({
      score: s,
      line: `Олдвор: ${body} (${meta})`,
    });
  }

  hits.sort((a, b) => b.score - a.score);
  const lines = hits.slice(0, MAX_INSPECTION_HITS).map((h) => h.line);
  if (lines.length) {
    lines.unshift(
      `Шалгалтын олдвор/дүгнэлт (хайлт · дээд тал ${MAX_INSPECTION_HITS}, эрх: ${scope.scopeNote}):`,
    );
  }
  return lines;
}
