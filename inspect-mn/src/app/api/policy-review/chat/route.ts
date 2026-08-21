import { NextResponse } from "next/server";
import { requireAiAccess } from "@/lib/ai/access";
import { getPolicyReviewSession } from "@/lib/policy-review/review-session";
import type {
  PolicyReviewChatCitation,
  PolicyReviewChatMessage,
  ReviewChunk,
} from "@/lib/policy-review/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  reviewId?: string;
  message?: string;
  history?: PolicyReviewChatMessage[];
};

const STOP_WORDS = new Set(["юу", "вэ", "нь", "ба", "болон", "энэ", "тэр", "тухай", "ямар", "хэрхэн"]);

function normalize(value: string) {
  return value.toLocaleLowerCase("mn").replace(/[^\p{L}\p{N}%]+/gu, " ").trim();
}

function queryTokens(value: string) {
  return [...new Set(normalize(value).split(/\s+/).filter((token) => token.length > 2 && !STOP_WORDS.has(token)))].slice(0, 12);
}

function scoreChunk(chunk: ReviewChunk, tokens: string[]) {
  const text = normalize(`${chunk.section ?? ""} ${chunk.text}`);
  return tokens.reduce((score, token) => score + (text.includes(token) ? token.length : 0), 0);
}

function quoteSupported(quote: string, text: string) {
  const normalized = normalize(quote);
  return normalized.length >= 10 && normalize(text).includes(normalized);
}

function evidenceForQuestion(chunks: ReviewChunk[], message: string, citedIds: Set<string>) {
  const tokens = queryTokens(message);
  return chunks
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, tokens) + (citedIds.has(chunk.id) ? 100 : 0) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 28)
    .map((item) => item.chunk);
}

function citationFromChunk(chunk: ReviewChunk, quote?: string): PolicyReviewChatCitation {
  const selected = quote?.trim() || chunk.text.slice(0, 360).trim();
  return {
    documentName: chunk.documentName,
    page: chunk.page,
    section: chunk.section,
    quote: selected,
    supported: quoteSupported(selected, chunk.text),
  };
}

async function answerWithOpenAi(
  message: string,
  history: PolicyReviewChatMessage[],
  evidence: ReviewChunk[],
) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You answer questions about a completed policy document comparison. Use only the supplied evidence chunks. Return strict JSON: {"answer":"Mongolian answer","citations":[{"chunkId":"existing id","quote":"exact verbatim quote"}]}. Never invent a clause, page, section, or conclusion. Citations must use an existing chunkId and exact quote copied from that chunk. If evidence does not support the answer, say that the selected documents do not provide enough evidence and return an empty citations array.`,
        },
        ...history.slice(-6).map((item) => ({ role: item.role, content: item.content })),
        {
          role: "user",
          content: `Question: ${message}\n\nEvidence:\n${JSON.stringify(evidence.map((chunk) => ({ chunkId: chunk.id, document: chunk.documentName, page: chunk.page, section: chunk.section, text: chunk.text.slice(0, 900) })))}`,
        },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI ${response.status}: ${(await response.text()).slice(0, 160)}`);
  const payload = (await response.json()) as { choices?: Array<{ message?: { content?: string | null } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI хариу хоосон байна.");
  return JSON.parse(content) as {
    answer?: string;
    citations?: Array<{ chunkId?: string; quote?: string }>;
  };
}

export async function POST(request: Request) {
  const access = await requireAiAccess();
  if (access.error) return access.error;
  try {
    const body = (await request.json()) as Body;
    const reviewId = body.reviewId?.trim() ?? "";
    const message = body.message?.trim() ?? "";
    if (!reviewId || message.length < 2) {
      return NextResponse.json({ ok: false, error: "Харьцуулалт болон асуулт шаардлагатай." }, { status: 400 });
    }
    const session = await getPolicyReviewSession(access.user.id, reviewId);
    if (!session) {
      return NextResponse.json(
        { ok: false, error: "Харьцуулалтын AI session дууссан. Баримтуудаа дахин харьцуулна уу." },
        { status: 410 },
      );
    }
    const citedIds = new Set(session.result.findings.flatMap((finding) => finding.citations.map((citation) => citation.chunkId)));
    const evidence = evidenceForQuestion(session.chunks, message, citedIds);
    if (evidence.length === 0) {
      return NextResponse.json({
        ok: true,
        answer: "Сонгосон баримтуудаас энэ асуултыг нотлох хэсэг олдсонгүй.",
        citations: [],
        supported: false,
      });
    }

    const ai = await answerWithOpenAi(message, Array.isArray(body.history) ? body.history : [], evidence);
    if (!ai) {
      const citations = evidence.slice(0, 3).map((chunk) => citationFromChunk(chunk));
      return NextResponse.json({
        ok: true,
        answer: "OPENAI_API_KEY тохируулаагүй тул хамгийн ойр эх заалтуудыг харууллаа. Дүгнэлтийг эх эшлэлтэй тулгаж шалгана уу.",
        citations,
        supported: citations.every((citation) => citation.supported),
      });
    }

    const byId = new Map(evidence.map((chunk) => [chunk.id, chunk]));
    const citations = (ai.citations ?? [])
      .map((citation) => {
        const chunk = citation.chunkId ? byId.get(citation.chunkId) : undefined;
        return chunk ? citationFromChunk(chunk, citation.quote) : null;
      })
      .filter((citation): citation is PolicyReviewChatCitation => Boolean(citation));
    const supported = citations.length > 0 && citations.every((citation) => citation.supported);
    return NextResponse.json({
      ok: true,
      answer: ai.answer?.trim() || "Нотолгоотой хариу үүсгэж чадсангүй.",
      citations,
      supported,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "AI асуултад хариулахад алдаа гарлаа." },
      { status: 500 },
    );
  }
}
