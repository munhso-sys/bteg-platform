import { NextResponse } from "next/server";
import { requireGlossaryAccess } from "@/lib/glossary/access";
import { buildGlossaryInsights } from "@/lib/glossary/insights";
import { readGlossaryDb } from "@/lib/glossary/store";
import { resolveGlossaryTerms } from "@/lib/glossary/terms";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireGlossaryAccess();
  if ("error" in ctx) return ctx.error;

  try {
    const db = await readGlossaryDb();
    const terms = resolveGlossaryTerms(db);
    const insights = await buildGlossaryInsights(terms);
    return NextResponse.json({
      ok: true,
      canEdit: ctx.canEdit,
      meta: db.meta,
      insights,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Платформ хайлт хийхэд алдаа",
      },
      { status: 500 },
    );
  }
}
