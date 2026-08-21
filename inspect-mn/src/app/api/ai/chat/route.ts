import { NextResponse } from "next/server";
import { requireAiAccess } from "@/lib/ai/access";
import {
  askOpenAi,
  buildAiContext,
} from "@/lib/ai/context";
import type { AiChatModule, AiChatHistoryItem } from "@/lib/ai/types";
import { readAiScopeConfig } from "@/lib/ai/scope-config-store";
import { resolveAiDataScope } from "@/lib/ai/resolve-scope";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Body = {
  message?: string;
  module?: AiChatModule;
  history?: AiChatHistoryItem[];
};

export async function POST(req: Request) {
  const access = await requireAiAccess();
  if (access.error) return access.error;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON body шаардлагатай" },
      { status: 400 },
    );
  }

  const message = (body.message ?? "").trim();
  if (message.length < 2) {
    return NextResponse.json(
      { ok: false, error: "Асуулт хоосон байна" },
      { status: 400 },
    );
  }

  const targetModule = body.module ?? "general";
  try {
    const config = await readAiScopeConfig();
    const scope = resolveAiDataScope(access.profile, access.roleId, config);
    const context = await buildAiContext(targetModule, scope, { query: message });
    const answer = await askOpenAi({
      message,
      context,
      history: Array.isArray(body.history) ? body.history : [],
    });

    return NextResponse.json({
      ok: true,
      answer,
      module: targetModule,
      generatedAt: context.generatedAt,
      source: context.openaiConfigured ? "openai" : "local",
      scopeMode: context.scopeMode,
      scopeNote: context.scopeNote,
      kpis: context.kpis.slice(0, 8),
      highlights: context.highlights.slice(0, 8),
      sourceErrors: context.sourceErrors,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "AI хүсэлт амжилтгүй",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  const access = await requireAiAccess();
  if (access.error) return access.error;
  try {
    const config = await readAiScopeConfig();
    const scope = resolveAiDataScope(access.profile, access.roleId, config);
    const context = await buildAiContext("general", scope);
    return NextResponse.json({
      ok: true,
      openaiConfigured: context.openaiConfigured,
      generatedAt: context.generatedAt,
      scopeMode: context.scopeMode,
      scopeNote: context.scopeNote,
      kpis: context.kpis.slice(0, 10),
      highlights: context.highlights.slice(0, 8),
      sourceErrors: context.sourceErrors,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Контекст ачаалахад алдаа",
      },
      { status: 500 },
    );
  }
}
