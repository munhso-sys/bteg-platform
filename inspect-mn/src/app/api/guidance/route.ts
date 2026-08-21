import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { currentAccess } from "@/lib/rbac/permissions";
import { readGuidanceDb, updateGuidanceDb } from "@/lib/guidance/store";
import {
  clampProgress,
  isGuidancePriority,
  isGuidanceStatus,
  isGuidanceUpdateKind,
  type GuidancePriority,
  type GuidanceRecord,
  type GuidanceStatus,
} from "@/lib/guidance/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function accessContext() {
  const access = await currentAccess();
  if (!access.profile || access.profile.status !== "active") {
    return { error: NextResponse.json({ ok: false, error: "Нэвтрэх эрхгүй" }, { status: 401 }) };
  }
  const canView = access.isAdmin || access.permissions.has("module.guidance.view") || access.permissions.has("module.guidance.edit") || access.permissions.has("module.development.view") || access.permissions.has("module.development.edit");
  if (!canView) return { error: NextResponse.json({ ok: false, error: "Удирдамж харах эрхгүй" }, { status: 403 }) };
  return {
    access,
    canEdit: access.isAdmin || access.permissions.has("module.guidance.edit") || access.permissions.has("module.development.edit"),
  };
}

function value(input: unknown, max = 5_000) {
  return String(input ?? "").trim().slice(0, max);
}

function apiError(error: unknown, fallback: string) {
  return NextResponse.json(
    { ok: false, error: error instanceof Error ? error.message : fallback },
    { status: 500 },
  );
}

export async function GET() {
  const ctx = await accessContext();
  if ("error" in ctx) return ctx.error;
  try {
    const db = await readGuidanceDb();
    return NextResponse.json({
      ok: true,
      canEdit: ctx.canEdit,
      items: db.items.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    });
  } catch (error) {
    return apiError(error, "Удирдамж ачаалахад алдаа");
  }
}

export async function POST(req: Request) {
  const ctx = await accessContext();
  if ("error" in ctx) return ctx.error;
  if (!ctx.canEdit) return NextResponse.json({ ok: false, error: "Удирдамж бүртгэх эрхгүй" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const title = value(body.title, 300);
  const objective = value(body.objective);
  if (!title || !objective) return NextResponse.json({ ok: false, error: "Гарчиг болон зорилго шаардлагатай" }, { status: 400 });

  const now = new Date().toISOString();
  const profile = ctx.access.profile!;
  const progress = clampProgress(body.progress);
  const status: GuidanceStatus = isGuidanceStatus(body.status) ? body.status : "planned";
  const priority: GuidancePriority = isGuidancePriority(body.priority) ? body.priority : "medium";
  const item: GuidanceRecord = {
    id: randomUUID(),
    referenceNo: value(body.referenceNo, 120),
    title,
    objective,
    priority,
    status,
    progress: status === "completed" ? 100 : progress,
    directiveDate: value(body.directiveDate, 10),
    dueDate: value(body.dueDate, 10),
    ownerName: value(body.ownerName, 200) || profile.full_name,
    unitName: value(body.unitName, 200) || profile.alba_name || profile.heltes_name || "",
    planDetails: value(body.planDetails),
    executionNotes: value(body.executionNotes),
    resultSummary: value(body.resultSummary),
    resultMetric: value(body.resultMetric, 1_000),
    evidence: value(body.evidence),
    createdAt: now,
    createdBy: profile.user_id,
    createdByName: profile.full_name,
    updatedAt: now,
    updates: [{
      id: randomUUID(),
      kind: "plan",
      note: "Удирдамж бүртгэж, ажлын төлөвлөгөө үүсгэв.",
      progress: status === "completed" ? 100 : progress,
      createdAt: now,
      createdBy: profile.user_id,
      createdByName: profile.full_name,
    }],
  };
  try {
    await updateGuidanceDb((db) => db.items.push(item));
    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (error) {
    return apiError(error, "Удирдамж хадгалахад алдаа");
  }
}

export async function PATCH(req: Request) {
  const ctx = await accessContext();
  if ("error" in ctx) return ctx.error;
  if (!ctx.canEdit) return NextResponse.json({ ok: false, error: "Удирдамж засах эрхгүй" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = value(body.id, 100);
  if (!id) return NextResponse.json({ ok: false, error: "id шаардлагатай" }, { status: 400 });
  let updated: GuidanceRecord | null = null;
  const now = new Date().toISOString();
  const profile = ctx.access.profile!;

  try {
    await updateGuidanceDb((db) => {
      const item = db.items.find((row) => row.id === id);
      if (!item) return;
    const fields = body.fields && typeof body.fields === "object" ? body.fields as Record<string, unknown> : {};
    if (fields.title !== undefined) item.title = value(fields.title, 300) || item.title;
    if (fields.referenceNo !== undefined) item.referenceNo = value(fields.referenceNo, 120);
    if (fields.objective !== undefined) item.objective = value(fields.objective) || item.objective;
    if (fields.ownerName !== undefined) item.ownerName = value(fields.ownerName, 200);
    if (fields.unitName !== undefined) item.unitName = value(fields.unitName, 200);
    if (fields.directiveDate !== undefined) item.directiveDate = value(fields.directiveDate, 10);
    if (fields.dueDate !== undefined) item.dueDate = value(fields.dueDate, 10);
    if (fields.planDetails !== undefined) item.planDetails = value(fields.planDetails);
    if (fields.executionNotes !== undefined) item.executionNotes = value(fields.executionNotes);
    if (fields.resultSummary !== undefined) item.resultSummary = value(fields.resultSummary);
    if (fields.resultMetric !== undefined) item.resultMetric = value(fields.resultMetric, 1_000);
    if (fields.evidence !== undefined) item.evidence = value(fields.evidence);
    if (isGuidancePriority(fields.priority)) item.priority = fields.priority;
    if (isGuidanceStatus(fields.status)) item.status = fields.status;
    if (fields.progress !== undefined) item.progress = clampProgress(fields.progress);
    if (item.status === "completed") item.progress = 100;

    const update = body.update && typeof body.update === "object" ? body.update as Record<string, unknown> : null;
    const note = value(update?.note);
    if (update && note) {
      const nextProgress = update.progress === undefined ? item.progress : clampProgress(update.progress);
      item.progress = item.status === "completed" ? 100 : nextProgress;
      item.updates.push({
        id: randomUUID(),
        kind: isGuidanceUpdateKind(update.kind) ? update.kind : "progress",
        note,
        progress: item.progress,
        createdAt: now,
        createdBy: profile.user_id,
        createdByName: profile.full_name,
      });
    }
    item.updatedAt = now;
      updated = item;
    });
  } catch (error) {
    return apiError(error, "Удирдамж шинэчлэхэд алдаа");
  }
  if (!updated) return NextResponse.json({ ok: false, error: "Удирдамж олдсонгүй" }, { status: 404 });
  return NextResponse.json({ ok: true, item: updated });
}
