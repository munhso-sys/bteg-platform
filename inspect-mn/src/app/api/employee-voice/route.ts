import { NextResponse } from "next/server";
import { requireVoiceAccess } from "@/lib/voice/access";
import { newId, readVoiceDb, updateVoiceDb } from "@/lib/voice/store";
import { classifyVoiceText, predictAction } from "@/lib/voice/classify";
import { ensurePredictedAction } from "@/lib/voice/overview";
import { filterVoiceDbByUnit } from "@/lib/voice/unit-filter";
import type {
  EmployeeVoiceItem,
  VoicePriority,
  VoiceStatus,
  VoiceType,
} from "@/lib/voice/types";

const TYPES = new Set<VoiceType>([
  "suggestion",
  "request",
  "complaint",
  "survey",
]);
const STATUSES = new Set<VoiceStatus>([
  "new",
  "in_progress",
  "planned",
  "resolved",
  "rejected",
  "closed",
]);
const PRIORITIES = new Set<VoicePriority>([
  "low",
  "medium",
  "high",
  "critical",
]);

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireVoiceAccess();
  if (access.error) return access.error;
  const raw = await readVoiceDb();
  const db = filterVoiceDbByUnit(raw, access.unitScope);
  return NextResponse.json({ ok: true, ...db });
}

export async function POST(req: Request) {
  const access = await requireVoiceAccess();
  if (access.error) return access.error;
  const body = (await req.json()) as Partial<EmployeeVoiceItem> & {
    autoClassify?: boolean;
  };
  const title = (body.title || "").trim();
  const description = (body.description || "").trim();
  if (!title) {
    return NextResponse.json(
      { ok: false, error: "Гарчиг оруулна уу" },
      { status: 400 },
    );
  }
  const classified = body.autoClassify
    ? classifyVoiceText(`${title} ${description}`)
    : null;
  const now = new Date().toISOString();
  const type = TYPES.has(body.type as VoiceType)
    ? (body.type as VoiceType)
    : classified?.type || "suggestion";
  const priority = PRIORITIES.has(body.priority as VoicePriority)
    ? (body.priority as VoicePriority)
    : classified?.priority || "medium";
  const predicted = predictAction({ type, priority, title });

  const unitDepartment =
    access.unitScope.active
      ? access.unitScope.albaName ||
        access.unitScope.heltesName ||
        body.department?.trim() ||
        ""
      : body.department?.trim() || "";

  const item: EmployeeVoiceItem = {
    id: newId(),
    type,
    title,
    description,
    status: STATUSES.has(body.status as VoiceStatus)
      ? (body.status as VoiceStatus)
      : "new",
    priority,
    department: unitDepartment,
    submittedBy: body.isAnonymous
      ? "Нэргүй"
      : body.submittedBy?.trim() || access.user.email || "",
    assignedTo: body.assignedTo?.trim() || "",
    source: body.source === "telegram" || body.source === "survey" ? body.source : "web",
    isAnonymous: Boolean(body.isAnonymous),
    telegramId: body.telegramId ?? null,
    dueDate: body.dueDate || null,
    voiceDate: body.voiceDate || now.slice(0, 10),
    actionTaken: body.actionTaken || "",
    analysisNote: body.analysisNote || "",
    predictedAction: predicted.title,
    notifyRisk: Boolean(body.notifyRisk) || predicted.notifyRisk,
    notifyResearch: Boolean(body.notifyResearch) || predicted.notifyResearch,
    surveyTopic: body.surveyTopic || "",
    createdAt: now,
    updatedAt: now,
  };

  const db = await updateVoiceDb((store) => {
    const ensured = ensurePredictedAction(item, store.actions, newId);
    store.items.unshift(ensured.item);
    store.actions = ensured.actions;
  });

  return NextResponse.json({
    ok: true,
    item,
    db: filterVoiceDbByUnit(db, access.unitScope),
  });
}
