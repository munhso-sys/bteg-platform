import type { PolicyReviewResult, ReviewChunk } from "./types";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";

type ReviewSession = {
  userId: string;
  result: PolicyReviewResult;
  chunks: ReviewChunk[];
  expiresAt: number;
};

type SessionMemory = Map<string, ReviewSession>;
const TTL_MS = 30 * 60 * 1000;
const MAX_SESSIONS = 30;

function sessions(): SessionMemory {
  const globalMemory = globalThis as typeof globalThis & {
    __policyReviewSessions?: SessionMemory;
  };
  if (!globalMemory.__policyReviewSessions) {
    globalMemory.__policyReviewSessions = new Map();
  }
  return globalMemory.__policyReviewSessions;
}

function removeExpired(memory: SessionMemory) {
  const now = Date.now();
  for (const [id, session] of memory) {
    if (session.expiresAt <= now) memory.delete(id);
  }
  while (memory.size >= MAX_SESSIONS) {
    const oldest = memory.keys().next().value as string | undefined;
    if (!oldest) break;
    memory.delete(oldest);
  }
}

function sessionKey(reviewId: string) {
  return `policy_review_session:${reviewId}`;
}

export async function registerPolicyReviewSession(
  userId: string,
  result: PolicyReviewResult,
  chunks: ReviewChunk[],
) {
  const memory = sessions();
  removeExpired(memory);
  memory.set(result.id, {
    userId,
    result,
    chunks: chunks.slice(0, 720),
    expiresAt: Date.now() + TTL_MS,
  });
  if (hasServiceRole()) {
    const session = memory.get(result.id)!;
    const { error } = await createAdminClient().from("app_data_store").upsert(
      {
        key: sessionKey(result.id),
        payload: session,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" },
    );
    if (error) console.warn("[policy-review-session] persist failed", error.message);
  }
}

export async function getPolicyReviewSession(userId: string, reviewId: string) {
  const memory = sessions();
  removeExpired(memory);
  let session = memory.get(reviewId);
  if (!session && hasServiceRole()) {
    const { data, error } = await createAdminClient()
      .from("app_data_store")
      .select("payload")
      .eq("key", sessionKey(reviewId))
      .maybeSingle();
    if (error) console.warn("[policy-review-session] restore failed", error.message);
    const payload = data?.payload as ReviewSession | undefined;
    if (payload?.result?.id === reviewId && Array.isArray(payload.chunks)) {
      session = payload;
      memory.set(reviewId, payload);
    }
  }
  if (!session || session.userId !== userId) return null;
  if (session.expiresAt <= Date.now()) {
    memory.delete(reviewId);
    return null;
  }
  session.expiresAt = Date.now() + TTL_MS;
  return session;
}
