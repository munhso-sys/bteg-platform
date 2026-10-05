import { NextResponse } from "next/server";
import { requireGlossaryAccess } from "@/lib/glossary/access";
import { updateGlossaryDb } from "@/lib/glossary/store";
import { mergeTerm, SEED_TERMS } from "@/lib/glossary/terms";
import type { GlossaryTerm } from "@/lib/glossary/types";

export const dynamic = "force-dynamic";

function trim(value: unknown, max = 8000) {
  return String(value ?? "").trim().slice(0, max);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await requireGlossaryAccess();
  if ("error" in ctx) return ctx.error;
  if (!ctx.canEdit) {
    return NextResponse.json(
      { ok: false, error: "Засварлах эрхгүй" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch = {
    abbr: body.abbr !== undefined ? trim(body.abbr, 120) : undefined,
    en: body.en !== undefined ? trim(body.en, 500) : undefined,
    mn: body.mn !== undefined ? trim(body.mn, 500) : undefined,
    definition:
      body.definition !== undefined ? trim(body.definition, 8000) : undefined,
  };

  if (
    patch.abbr === undefined &&
    patch.en === undefined &&
    patch.mn === undefined &&
    patch.definition === undefined
  ) {
    return NextResponse.json(
      { ok: false, error: "Засах талбар оруулаагүй байна" },
      { status: 400 },
    );
  }

  try {
    let term: GlossaryTerm | null = null;
    await updateGlossaryDb((db) => {
      const seed = SEED_TERMS.find((row) => row.id === id);
      const customIndex = db.customTerms.findIndex((row) => row.id === id);
      if (!seed && customIndex < 0) {
        throw new Error("Нэр томъёо олдсонгүй");
      }

      db.overrides[id] = {
        ...db.overrides[id],
        ...patch,
        updatedAt: new Date().toISOString(),
        updatedBy: ctx.user.id,
      };

      if (customIndex >= 0) {
        const base = db.customTerms[customIndex];
        db.customTerms[customIndex] = {
          ...base,
          abbr: patch.abbr ?? base.abbr,
          en: patch.en ?? base.en,
          mn: patch.mn ?? base.mn,
          definition: patch.definition ?? base.definition,
        };
        term = db.customTerms[customIndex];
      } else if (seed) {
        term = mergeTerm(seed, db.overrides);
      }
    });

    return NextResponse.json({ ok: true, term });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Хадгалахад алдаа";
    const status = message.includes("олдсонгүй") ? 404 : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
