import { NextResponse } from "next/server";
import { requireGlossaryAccess } from "@/lib/glossary/access";
import { readGlossaryDb } from "@/lib/glossary/store";
import {
  collectMnLetters,
  groupByMnLetter,
  resolveGlossaryTerms,
} from "@/lib/glossary/terms";

export const dynamic = "force-dynamic";

export async function GET() {
  const ctx = await requireGlossaryAccess();
  if ("error" in ctx) return ctx.error;

  try {
    const db = await readGlossaryDb();
    const terms = resolveGlossaryTerms(db);
    const groups = groupByMnLetter(terms);
    const letters = collectMnLetters(terms);

    return NextResponse.json({
      ok: true,
      canEdit: ctx.canEdit,
      termCount: terms.length,
      letters,
      groups,
      terms,
      meta: db.meta,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Толь ачаалахад алдаа",
      },
      { status: 500 },
    );
  }
}
