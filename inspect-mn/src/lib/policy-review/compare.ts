import type {
  ExtractedDocument,
  PolicyReviewResult,
  ReviewChunk,
  ReviewCitation,
  ReviewFinding,
  ReviewFindingType,
  ReviewSeverity,
} from "./types";

type CandidatePair = {
  left: ReviewChunk;
  right: ReviewChunk;
  similarity: number;
  numberDifference: boolean;
  modalDifference: boolean;
  polarityConflict: boolean;
};

const STOP_WORDS = new Set([
  "ба",
  "болон",
  "нь",
  "юм",
  "энэ",
  "тухайн",
  "the",
  "and",
  "or",
  "of",
  "to",
]);

const REQUIREMENT_RE =
  /(ёстой|шаардлагатай|үүрэгтэй|хориглоно|болохгүй|гүйцэтгэнэ|мэдэгдэнэ|\b(?:must|shall|required|prohibited|may not)\b)/i;
const PROHIBITION_RE =
  /(хориглоно|болохгүй|үл зөвшөөрнө|\b(?:prohibited|may not|must not)\b)/i;
const PERMISSION_RE =
  /(зөвшөөрнө|болно|эрхтэй|\b(?:permitted|may|allowed)\b)/i;
const OBLIGATION_RE =
  /(ёстой|шаардлагатай|үүрэгтэй|гүйцэтгэнэ|\b(?:must|shall|required)\b)/i;

function normalize(value: string) {
  return value.toLowerCase().replace(/[^\p{L}\p{N}%]+/gu, " ").trim();
}

function tokenSet(value: string) {
  return new Set(
    normalize(value)
      .split(/\s+/)
      .filter((token) => token.length > 2 && !STOP_WORDS.has(token)),
  );
}

function jaccard(a: Set<string>, b: Set<string>) {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

function numbers(value: string) {
  return [...value.matchAll(/\b\d+(?:[.,]\d+)?%?\b/g)].map((match) =>
    match[0].replace(",", "."),
  );
}

function requirementNumbers(chunk: ReviewChunk) {
  const withoutLeadingSection = chunk.text.replace(
    /^\s*\d+(?:\.\d+){0,5}[.)]?\s+/,
    "",
  );
  return numbers(withoutLeadingSection);
}

function authorizationConflict(left: string, right: string) {
  const withoutApproval = /зөвшөөрөлгүй|without (?:prior )?approval/i;
  const withApproval =
    /зөвшөөрлөөр|зөвшөөрөлтэй|урьдчилсан[^.]{0,40}зөвшөөр|with (?:prior )?approval/i;
  return (
    (withoutApproval.test(left) && withApproval.test(right)) ||
    (withoutApproval.test(right) && withApproval.test(left))
  );
}

function sameStringArray(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function excerpt(value: string, max = 360) {
  const text = value.replace(/\s+/g, " ").trim();
  return text.length <= max ? text : text.slice(0, max);
}

function citation(chunk: ReviewChunk): ReviewCitation {
  return {
    documentId: chunk.documentId,
    documentName: chunk.documentName,
    chunkId: chunk.id,
    page: chunk.page,
    section: chunk.section,
    quote: excerpt(chunk.text),
    supported: true,
  };
}

function buildCandidates(chunks: ReviewChunk[]) {
  const byDocument = new Map<string, ReviewChunk[]>();
  for (const chunk of chunks) {
    const list = byDocument.get(chunk.documentId) ?? [];
    list.push(chunk);
    byDocument.set(chunk.documentId, list);
  }

  const ids = [...byDocument.keys()];
  const candidates: CandidatePair[] = [];
  const bestOtherScore = new Map<string, number>();

  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const leftChunks = byDocument.get(ids[i]) ?? [];
      const rightChunks = byDocument.get(ids[j]) ?? [];
      for (const left of leftChunks) {
        const leftTokens = tokenSet(`${left.section ?? ""} ${left.text}`);
        for (const right of rightChunks) {
          const similarity = jaccard(
            leftTokens,
            tokenSet(`${right.section ?? ""} ${right.text}`),
          );
          bestOtherScore.set(
            left.id,
            Math.max(bestOtherScore.get(left.id) ?? 0, similarity),
          );
          bestOtherScore.set(
            right.id,
            Math.max(bestOtherScore.get(right.id) ?? 0, similarity),
          );
          if (similarity < 0.12) continue;

          const leftNumbers = requirementNumbers(left);
          const rightNumbers = requirementNumbers(right);
          const numberDifference =
            leftNumbers.length > 0 &&
            rightNumbers.length > 0 &&
            !sameStringArray(leftNumbers, rightNumbers);
          const modalDifference =
            OBLIGATION_RE.test(left.text) !== OBLIGATION_RE.test(right.text) ||
            PERMISSION_RE.test(left.text) !== PERMISSION_RE.test(right.text);
          const polarityConflict =
            (PROHIBITION_RE.test(left.text) && PERMISSION_RE.test(right.text)) ||
            (PROHIBITION_RE.test(right.text) && PERMISSION_RE.test(left.text)) ||
            authorizationConflict(left.text, right.text);

          candidates.push({
            left,
            right,
            similarity,
            numberDifference,
            modalDifference,
            polarityConflict,
          });
        }
      }
    }
  }

  candidates.sort((a, b) => {
    const signalA =
      a.similarity +
      (a.polarityConflict ? 0.8 : 0) +
      (a.numberDifference ? 0.35 : 0) +
      (a.modalDifference ? 0.2 : 0);
    const signalB =
      b.similarity +
      (b.polarityConflict ? 0.8 : 0) +
      (b.numberDifference ? 0.35 : 0) +
      (b.modalDifference ? 0.2 : 0);
    return signalB - signalA;
  });

  return { candidates, bestOtherScore };
}

function makeFinding(
  index: number,
  type: ReviewFindingType,
  severity: ReviewSeverity,
  title: string,
  summary: string,
  rationale: string,
  chunks: ReviewChunk[],
): ReviewFinding {
  return {
    id: `finding-${index}`,
    type,
    severity,
    title,
    summary,
    rationale,
    supported: chunks.length > 0,
    citations: chunks.map(citation),
  };
}

function localFindings(
  chunks: ReviewChunk[],
  candidates: CandidatePair[],
  bestOtherScore: Map<string, number>,
) {
  const findings: ReviewFinding[] = [];
  const usedPairs = new Set<string>();

  for (const pair of candidates) {
    if (findings.length >= 14) break;
    const pairKey = [pair.left.id, pair.right.id].sort().join("|");
    if (usedPairs.has(pairKey)) continue;

    if (pair.polarityConflict && pair.similarity >= 0.2) {
      findings.push(
        makeFinding(
          findings.length + 1,
          "contradiction",
          "high",
          "Зөвшөөрөл ба хоригийн зөрчил",
          `${pair.left.documentName} болон ${pair.right.documentName}-д ижил сэдвийг эсрэг байдлаар зохицуулсан байж болзошгүй.`,
          `Түлхүүр агуулгын давхцал ${(pair.similarity * 100).toFixed(0)}%; нэг заалт хориг, нөгөө нь зөвшөөрлийн хэлбэртэй.`,
          [pair.left, pair.right],
        ),
      );
      usedPairs.add(pairKey);
      continue;
    }

    if (pair.similarity >= 0.28 && pair.numberDifference) {
      findings.push(
        makeFinding(
          findings.length + 1,
          "conflict",
          "high",
          "Тоон шаардлага зөрүүтэй",
          "Ижил буюу ойролцоо шаардлагад өөр тоо, хувь эсвэл хугацаа заасан байна.",
          `Ижил төстэй байдал ${(pair.similarity * 100).toFixed(0)}%; илэрсэн утгууд: ${requirementNumbers(pair.left).join(", ")} ↔ ${requirementNumbers(pair.right).join(", ")}.`,
          [pair.left, pair.right],
        ),
      );
      usedPairs.add(pairKey);
      continue;
    }

    if (pair.similarity >= 0.32 && pair.modalDifference) {
      findings.push(
        makeFinding(
          findings.length + 1,
          "difference",
          "medium",
          "Үүрэгжүүлсэн түвшин ялгаатай",
          "Нэг баримт шаардлага/үүрэг хэлбэрээр, нөгөө баримт зөвшөөрөл эсвэл ерөнхий хэлбэрээр тусгасан байна.",
          `Ижил төстэй байдал ${(pair.similarity * 100).toFixed(0)}%; modal хэлбэрүүд ижил биш.`,
          [pair.left, pair.right],
        ),
      );
      usedPairs.add(pairKey);
      continue;
    }

    if (pair.similarity >= 0.82) {
      findings.push(
        makeFinding(
          findings.length + 1,
          "duplicate",
          "low",
          "Давхардсан зохицуулалт",
          "Хоёр баримтад бараг ижил агуулгатай заалт байна.",
          `Үгийн ижил төстэй байдал ${(pair.similarity * 100).toFixed(0)}%.`,
          [pair.left, pair.right],
        ),
      );
      usedPairs.add(pairKey);
    }
  }

  for (const chunk of chunks) {
    if (findings.length >= 18) break;
    if (!REQUIREMENT_RE.test(chunk.text)) continue;
    const best = bestOtherScore.get(chunk.id) ?? 0;
    if (best >= 0.1) continue;
    findings.push(
      makeFinding(
        findings.length + 1,
        "missing_requirement",
        "medium",
        "Бусад баримтад дүйцэх шаардлага олдсонгүй",
        `${chunk.documentName}-ийн шаардлагатай утга бусад сонгосон баримтад lexical хайлтаар илрээгүй.`,
        `Хамгийн ойр хэсгийн ижил төстэй байдал ${(best * 100).toFixed(0)}%. Эх заалтыг гараар баталгаажуулна уу.`,
        [chunk],
      ),
    );
  }

  return findings;
}

type LlmFinding = {
  type?: string;
  severity?: string;
  title?: string;
  summary?: string;
  rationale?: string;
  citations?: Array<{ chunkId?: string; quote?: string }>;
};

function asFindingType(value: string | undefined): ReviewFindingType | null {
  return [
    "difference",
    "contradiction",
    "conflict",
    "missing_requirement",
    "duplicate",
  ].includes(value ?? "")
    ? (value as ReviewFindingType)
    : null;
}

function asSeverity(value: string | undefined): ReviewSeverity {
  return value === "high" || value === "low" ? value : "medium";
}

function quoteIsSupported(quote: string, chunkText: string) {
  const normalizedQuote = normalize(quote);
  return normalizedQuote.length >= 12 && normalize(chunkText).includes(normalizedQuote);
}

async function openAiFindings(candidates: CandidatePair[], chunks: ReviewChunk[], focus?: string) {
  if (process.env.POLICY_REVIEW_DISABLE_OPENAI === "1") return null;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const chunkById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const evidence = candidates.slice(0, 36).map((pair, index) => ({
    candidate: index + 1,
    similarity: Number(pair.similarity.toFixed(3)),
    signals: {
      numberDifference: pair.numberDifference,
      modalDifference: pair.modalDifference,
      polarityConflict: pair.polarityConflict,
    },
    left: {
      chunkId: pair.left.id,
      document: pair.left.documentName,
      page: pair.left.page,
      section: pair.left.section,
      text: pair.left.text.slice(0, 760),
    },
    right: {
      chunkId: pair.right.id,
      document: pair.right.documentName,
      page: pair.right.page,
      section: pair.right.section,
      text: pair.right.text.slice(0, 760),
    },
  }));

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a policy comparison engine. Return strict JSON only: {"findings":[...]}. Detect only evidence-backed difference, contradiction, conflict, missing_requirement, or duplicate findings. Every finding needs type, severity (high|medium|low), title, summary, rationale, and citations. Each citation must contain an existing chunkId and an exact verbatim quote copied from that chunk. Never invent clauses. If evidence is insufficient, omit the finding. Use Mongolian for title, summary and rationale. Contradiction/conflict/difference/duplicate findings require citations from both documents.`,
        },
        {
          role: "user",
          content: `${focus ? `User review focus: ${focus}\n\n` : ""}Candidate evidence:\n${JSON.stringify(evidence)}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI ${response.status}: ${(await response.text()).slice(0, 180)}`);
  }
  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) return [];
  const parsed = JSON.parse(content) as { findings?: LlmFinding[] };
  const output: ReviewFinding[] = [];

  for (const raw of parsed.findings ?? []) {
    const type = asFindingType(raw.type);
    if (!type) continue;
    const citations = (raw.citations ?? []).map((item) => {
      const chunk = item.chunkId ? chunkById.get(item.chunkId) : undefined;
      const quote = item.quote?.trim() ?? "";
      if (!chunk) {
        return {
          documentId: "unknown",
          documentName: "Тодорхойгүй",
          chunkId: item.chunkId ?? "unknown",
          page: null,
          section: null,
          quote,
          supported: false,
        } satisfies ReviewCitation;
      }
      return {
        documentId: chunk.documentId,
        documentName: chunk.documentName,
        chunkId: chunk.id,
        page: chunk.page,
        section: chunk.section,
        quote,
        supported: quoteIsSupported(quote, chunk.text),
      } satisfies ReviewCitation;
    });
    const requiredCitationCount = type === "missing_requirement" ? 1 : 2;
    const supported =
      citations.length >= requiredCitationCount &&
      citations.every((item) => item.supported) &&
      new Set(citations.map((item) => item.documentId)).size >= requiredCitationCount;
    output.push({
      id: `ai-finding-${output.length + 1}`,
      type,
      severity: asSeverity(raw.severity),
      title: raw.title?.trim() || "Баримтын зөрүү",
      summary: raw.summary?.trim() || "Тайлбар ирээгүй.",
      rationale: raw.rationale?.trim() || "AI үндэслэл ирээгүй.",
      supported,
      citations,
    });
  }

  return output.slice(0, 16);
}

function findingKey(finding: ReviewFinding) {
  return `${finding.type}|${finding.citations
    .map((item) => item.chunkId)
    .sort()
    .join("|")}`;
}

export async function comparePolicyDocuments(
  documents: ExtractedDocument[],
  chunks: ReviewChunk[],
  focus?: string,
): Promise<PolicyReviewResult> {
  const warnings = documents.flatMap((document) => document.warnings);
  const { candidates, bestOtherScore } = buildCandidates(chunks);
  const fallback = localFindings(chunks, candidates, bestOtherScore);
  let mode: PolicyReviewResult["mode"] = "local";
  let findings = fallback;

  try {
    const ai = await openAiFindings(candidates, chunks, focus);
    if (ai) {
      mode = "openai";
      const seen = new Set(ai.map(findingKey));
      findings = [
        ...ai,
        ...fallback.filter((finding) => !seen.has(findingKey(finding))),
      ].slice(0, 20);
    } else {
      warnings.push("OPENAI_API_KEY байхгүй тул deterministic local review ашиглав.");
    }
  } catch (error) {
    warnings.push(
      `OpenAI review амжилтгүй; local review ашиглав: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

  findings = findings.map((finding, index) => ({
    ...finding,
    id: `finding-${index + 1}`,
  }));

  return {
    id: `review-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    mode,
    documents: documents.map((document) => ({
      id: document.id,
      name: document.name,
      mimeType: document.mimeType,
      pageCount: document.pages.length,
      characterCount: document.characterCount,
      chunkCount: chunks.filter((chunk) => chunk.documentId === document.id).length,
    })),
    findings,
    warnings,
    stats: {
      comparedPairs: candidates.length,
      supportedFindings: findings.filter((finding) => finding.supported).length,
      unsupportedFindings: findings.filter((finding) => !finding.supported).length,
      totalChunks: chunks.length,
      highRiskFindings: findings.filter((finding) => finding.severity === "high").length,
      contradictions: findings.filter((finding) => finding.type === "contradiction").length,
      conflicts: findings.filter((finding) => finding.type === "conflict").length,
      missingRequirements: findings.filter((finding) => finding.type === "missing_requirement").length,
      duplicates: findings.filter((finding) => finding.type === "duplicate").length,
      citationCoveragePct: findings.length
        ? Math.round((findings.filter((finding) => finding.supported).length / findings.length) * 100)
        : 100,
    },
  };
}
