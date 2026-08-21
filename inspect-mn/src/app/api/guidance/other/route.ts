import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { currentAccess } from "@/lib/rbac/permissions";
import { readOtherWorkDb, updateOtherWorkDb } from "@/lib/guidance/other-store";
import {
  isOtherWorkCategory,
  isOtherWorkStatus,
  otherWorkProgress,
  type OtherWorkRecord,
} from "@/lib/guidance/other-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function value(input: unknown, max = 5_000) {
  return String(input ?? "").trim().slice(0, max);
}

function failure(error: unknown, fallback: string) {
  return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : fallback }, { status: 500 });
}

async function accessContext() {
  const access = await currentAccess();
  if (!access.profile || access.profile.status !== "active") return { error: NextResponse.json({ ok: false, error: "Нэвтрэх эрхгүй" }, { status: 401 }) };
  const canView = access.isAdmin || access.permissions.has("module.guidance.view") || access.permissions.has("module.guidance.edit") || access.permissions.has("module.development.view") || access.permissions.has("module.development.edit");
  if (!canView) return { error: NextResponse.json({ ok: false, error: "Бусад ажил харах эрхгүй" }, { status: 403 }) };
  return { access, canEdit: access.isAdmin || access.permissions.has("module.guidance.edit") || access.permissions.has("module.development.edit") };
}

export async function GET() {
  const ctx = await accessContext();
  if ("error" in ctx) return ctx.error;
  try {
    const db = await readOtherWorkDb();
    return NextResponse.json({ ok: true, canEdit: ctx.canEdit, items: db.items.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) });
  } catch (error) {
    return failure(error, "Бусад ажлын бүртгэл ачаалахад алдаа");
  }
}

export async function POST(req: Request) {
  const ctx = await accessContext();
  if ("error" in ctx) return ctx.error;
  if (!ctx.canEdit) return NextResponse.json({ ok: false, error: "Бусад ажил бүртгэх эрхгүй" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const workName = value(body.workName, 300);
  if (!workName) return NextResponse.json({ ok: false, error: "Ажлын нэр шаардлагатай" }, { status: 400 });
  const profile = ctx.access.profile!;
  const now = new Date().toISOString();
  const status = isOtherWorkStatus(body.status) ? body.status : "planned";
  const progress = status === "completed" ? 100 : otherWorkProgress(body.progress);
  const item: OtherWorkRecord = {
    id: randomUUID(),
    workName,
    category: isOtherWorkCategory(body.category) ? body.category : "daily",
    frequencyDetail: value(body.frequencyDetail, 500),
    startAt: value(body.startAt, 30),
    endAt: value(body.endAt, 30),
    status,
    progress,
    plan: value(body.plan),
    execution: value(body.execution),
    result: value(body.result),
    responsibleName: value(body.responsibleName, 200) || profile.full_name,
    unitName: value(body.unitName, 200) || profile.alba_name || profile.heltes_name || "",
    approvedByName: value(body.approvedByName, 200),
    approvedAt: value(body.approvedAt, 30),
    handoverToName: value(body.handoverToName, 200),
    handoverAt: value(body.handoverAt, 30),
    handoverNote: value(body.handoverNote),
    otherInfo: value(body.otherInfo),
    createdAt: now,
    createdBy: profile.user_id,
    createdByName: profile.full_name,
    updatedAt: now,
    updates: [{ id: randomUUID(), note: "Ажлын бүртгэл үүсгэв.", progress, status, createdAt: now, createdBy: profile.user_id, createdByName: profile.full_name }],
  };
  try {
    await updateOtherWorkDb((db) => db.items.push(item));
    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (error) {
    return failure(error, "Бусад ажил хадгалахад алдаа");
  }
}

export async function PATCH(req: Request) {
  const ctx = await accessContext();
  if ("error" in ctx) return ctx.error;
  if (!ctx.canEdit) return NextResponse.json({ ok: false, error: "Бусад ажил засах эрхгүй" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = value(body.id, 100);
  const fields = body.fields && typeof body.fields === "object" ? body.fields as Record<string, unknown> : {};
  const profile = ctx.access.profile!;
  const now = new Date().toISOString();
  let updated: OtherWorkRecord | null = null;
  try {
    await updateOtherWorkDb((db) => {
      const item = db.items.find((row) => row.id === id);
      if (!item) return;
      const textFields = ["workName", "frequencyDetail", "startAt", "endAt", "plan", "execution", "result", "responsibleName", "unitName", "approvedByName", "approvedAt", "handoverToName", "handoverAt", "handoverNote", "otherInfo"] as const;
      for (const key of textFields) if (fields[key] !== undefined) item[key] = value(fields[key], key === "workName" ? 300 : 5_000);
      if (isOtherWorkCategory(fields.category)) item.category = fields.category;
      if (isOtherWorkStatus(fields.status)) item.status = fields.status;
      if (fields.progress !== undefined) item.progress = otherWorkProgress(fields.progress);
      if (item.status === "completed") item.progress = 100;
      const note = value(body.updateNote);
      if (note) item.updates.push({ id: randomUUID(), note, progress: item.progress, status: item.status, createdAt: now, createdBy: profile.user_id, createdByName: profile.full_name });
      item.updatedAt = now;
      updated = item;
    });
  } catch (error) {
    return failure(error, "Бусад ажил шинэчлэхэд алдаа");
  }
  if (!updated) return NextResponse.json({ ok: false, error: "Бүртгэл олдсонгүй" }, { status: 404 });
  return NextResponse.json({ ok: true, item: updated });
}
