import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireGlossaryAccess } from "@/lib/glossary/access";
import { readGlossaryDb, updateGlossaryDb } from "@/lib/glossary/store";
import type {
  GlossaryHomonym,
  GlossaryMeta,
  GlossarySourceDocument,
  GlossaryUsageLevel,
} from "@/lib/glossary/types";

export const dynamic = "force-dynamic";

function trim(value: unknown, max = 4000) {
  return String(value ?? "").trim().slice(0, max);
}

function parseHomonyms(value: unknown): GlossaryHomonym[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => ({
      id: trim((row as GlossaryHomonym).id || randomUUID(), 80),
      term: trim((row as GlossaryHomonym).term, 300),
      note: trim((row as GlossaryHomonym).note, 2000),
    }))
    .filter((row) => row.term || row.note);
}

function parseDocuments(value: unknown): GlossarySourceDocument[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row, index) => ({
      id: trim((row as GlossarySourceDocument).id || randomUUID(), 80),
      no: Number((row as GlossarySourceDocument).no) || index + 1,
      name: trim((row as GlossarySourceDocument).name, 500),
    }))
    .filter((row) => row.name);
}

function parseUsageLevels(value: unknown): GlossaryUsageLevel[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row, index) => ({
      id: trim((row as GlossaryUsageLevel).id || randomUUID(), 80),
      level: Number((row as GlossaryUsageLevel).level) || index + 1,
      description: trim((row as GlossaryUsageLevel).description, 2000),
    }))
    .filter((row) => row.description);
}

export async function GET() {
  const ctx = await requireGlossaryAccess();
  if ("error" in ctx) return ctx.error;

  try {
    const db = await readGlossaryDb();
    return NextResponse.json({
      ok: true,
      canEdit: ctx.canEdit,
      meta: db.meta,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error ? error.message : "Мэдээлэл ачаалахад алдаа",
      },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request) {
  const ctx = await requireGlossaryAccess();
  if ("error" in ctx) return ctx.error;
  if (!ctx.canEdit) {
    return NextResponse.json(
      { ok: false, error: "Засварлах эрхгүй" },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    let meta: GlossaryMeta | null = null;
    await updateGlossaryDb((db) => {
      const current = db.meta;
      db.meta = {
        ...current,
        title: body.title !== undefined ? trim(body.title, 300) : current.title,
        structureNote:
          body.structureNote !== undefined
            ? trim(body.structureNote, 2000)
            : current.structureNote,
        homonymsTitle:
          body.homonymsTitle !== undefined
            ? trim(body.homonymsTitle, 300)
            : current.homonymsTitle,
        homonymsNote:
          body.homonymsNote !== undefined
            ? trim(body.homonymsNote, 2000)
            : current.homonymsNote,
        homonyms:
          body.homonyms !== undefined
            ? parseHomonyms(body.homonyms)
            : current.homonyms,
        sourceDocumentsTitle:
          body.sourceDocumentsTitle !== undefined
            ? trim(body.sourceDocumentsTitle, 300)
            : current.sourceDocumentsTitle,
        sourceDocuments:
          body.sourceDocuments !== undefined
            ? parseDocuments(body.sourceDocuments)
            : current.sourceDocuments,
        usageLevelsTitle:
          body.usageLevelsTitle !== undefined
            ? trim(body.usageLevelsTitle, 300)
            : current.usageLevelsTitle,
        usageLevels:
          body.usageLevels !== undefined
            ? parseUsageLevels(body.usageLevels)
            : current.usageLevels,
        updatedAt: new Date().toISOString(),
      };
      meta = db.meta;
    });
    return NextResponse.json({ ok: true, meta });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Хадгалахад алдаа",
      },
      { status: 500 },
    );
  }
}
