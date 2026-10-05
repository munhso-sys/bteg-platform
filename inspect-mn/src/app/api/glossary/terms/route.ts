import { NextResponse } from "next/server";
import { requireGlossaryAccess } from "@/lib/glossary/access";
import { updateGlossaryDb } from "@/lib/glossary/store";
import { nextCustomTermId, resolveGlossaryTerms } from "@/lib/glossary/terms";
import type { GlossaryTerm } from "@/lib/glossary/types";

export const dynamic = "force-dynamic";

function trim(value: unknown, max = 8000) {
  return String(value ?? "").trim().slice(0, max);
}

export async function POST(req: Request) {
  const ctx = await requireGlossaryAccess();
  if ("error" in ctx) return ctx.error;
  if (!ctx.canEdit) {
    return NextResponse.json(
      { ok: false, error: "Засварлах эрхгүй" },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const mn = trim(body.mn, 500);
  const en = trim(body.en, 500);
  const abbr = trim(body.abbr, 120);
  const definition = trim(body.definition, 8000);

  if (!mn && !en) {
    return NextResponse.json(
      { ok: false, error: "Монгол эсвэл англи нэршил шаардлагатай" },
      { status: 400 },
    );
  }

  try {
    let created: GlossaryTerm | null = null;
    await updateGlossaryDb((db) => {
      const existing = resolveGlossaryTerms(db);
      const id = nextCustomTermId(existing);
      created = {
        id,
        mn,
        en,
        abbr,
        definition,
        source: "custom",
      };
      db.customTerms.push(created);
    });
    return NextResponse.json({ ok: true, term: created });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Нэмэхэд алдаа",
      },
      { status: 500 },
    );
  }
}
