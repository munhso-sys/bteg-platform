import { NextResponse } from "next/server";
import { requireAdminContext } from "@/lib/rbac/require-admin";
import {
  normalizeAiScopeConfig,
  type AiScopeConfig,
} from "@/lib/ai/scope-config";
import {
  readAiScopeConfig,
  writeAiScopeConfig,
} from "@/lib/ai/scope-config-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireAdminContext();
  if ("error" in ctx) return ctx.error;

  const config = await readAiScopeConfig({ fresh: true });
  return NextResponse.json({ ok: true, config });
}

type PatchBody = {
  config?: Partial<AiScopeConfig>;
};

export async function PATCH(req: Request) {
  const ctx = await requireAdminContext();
  if ("error" in ctx) return ctx.error;

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON body шаардлагатай" },
      { status: 400 },
    );
  }

  if (!body.config || typeof body.config !== "object") {
    return NextResponse.json(
      { ok: false, error: "config шаардлагатай" },
      { status: 400 },
    );
  }

  try {
    const current = await readAiScopeConfig({ fresh: true });
    const merged = normalizeAiScopeConfig({
      ...current,
      ...body.config,
      fullAccessRoles: body.config.fullAccessRoles ?? current.fullAccessRoles,
      unitScopedRoles: body.config.unitScopedRoles ?? current.unitScopedRoles,
      sources: body.config.sources
        ? { ...current.sources, ...body.config.sources }
        : current.sources,
    });
    const config = await writeAiScopeConfig(merged);
    return NextResponse.json({ ok: true, config });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Хадгалахад алдаа",
      },
      { status: 500 },
    );
  }
}
