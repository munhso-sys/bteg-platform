import { predictAction } from "@/lib/voice/classify";
import type {
  EmployeeVoiceItem,
  VoiceAction,
  VoiceDb,
  VoiceNotice,
} from "@/lib/voice/types";
import { VOICE_TYPE_LABELS } from "@/lib/voice/types";

export function closedStatuses() {
  return new Set(["resolved", "rejected", "closed"]);
}

export function isClosed(status: string) {
  return closedStatuses().has(status);
}

export function overviewFromDb(db: VoiceDb) {
  const items = [...db.items].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const open = items.filter((i) => !isClosed(i.status));
  const high = items.filter(
    (i) => i.priority === "high" || i.priority === "critical",
  );
  const telegram = items.filter((i) => i.source === "telegram");
  const byType = (["suggestion", "request", "complaint", "survey"] as const).map(
    (type) => ({
      type,
      label: VOICE_TYPE_LABELS[type],
      count: items.filter((i) => i.type === type).length,
      open: items.filter((i) => i.type === type && !isClosed(i.status)).length,
    }),
  );
  const actionOpen = db.actions.filter((a) => a.kind !== "done");
  const overdueActions = db.actions.filter((a) => {
    if (a.kind === "done" || !a.dueDate) return false;
    return a.dueDate < new Date().toISOString().slice(0, 10);
  });
  const themes = topThemes(items);
  const conclusions = buildConclusions({
    items,
    open,
    high,
    telegram,
    overdueActions,
  });
  return {
    generatedAt: new Date().toISOString(),
    kpis: {
      total: items.length,
      open: open.length,
      high: high.length,
      telegram: telegram.length,
      actionsOpen: actionOpen.length,
      overdue: overdueActions.length,
      notices: db.notices.filter((n) => n.status !== "acknowledged").length,
    },
    byType,
    themes,
    conclusions,
    recent: items.slice(0, 8),
    telegramUsers: db.telegramUsers.length,
  };
}

function topThemes(items: EmployeeVoiceItem[]) {
  const counts = new Map<string, number>();
  for (const item of items) {
    const words = `${item.title} ${item.department}`
      .split(/[\s,/·-]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 4);
    const key = item.department?.trim() || words[0] || VOICE_TYPE_LABELS[item.type];
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, count]) => ({ label, count }));
}

function buildConclusions(input: {
  items: EmployeeVoiceItem[];
  open: EmployeeVoiceItem[];
  high: EmployeeVoiceItem[];
  telegram: EmployeeVoiceItem[];
  overdueActions: VoiceAction[];
}) {
  const lines: string[] = [];
  if (input.items.length === 0) {
    return [
      "Одоогоор бүртгэл алга. Telegram бот эсвэл вэб формаар санал, хүсэлт, гомдол, асуулга хүлээн авна.",
    ];
  }
  lines.push(
    `Нийт ${input.items.length} бүртгэлээс ${input.open.length} нь нээлттэй.`,
  );
  lines.push(
    input.high.length
      ? `${input.high.length} өндөр/ноцтой бүртгэлийг нэн түрүүнд шийдвэрлэнэ.`
      : "Өндөр зэрэглэлийн бүртгэл одоогоор алга.",
  );
  if (input.telegram.length) {
    lines.push(`Telegram-аас ${input.telegram.length} бүртгэл орж ирсэн.`);
  }
  if (input.overdueActions.length) {
    lines.push(
      `Хариу арга хэмжээний ${input.overdueActions.length} нь хугацаа хэтэрсэн.`,
    );
  }
  const complaints = input.open.filter((i) => i.type === "complaint").length;
  if (complaints) {
    lines.push(
      `Нээлттэй гомдол ${complaints} — эрсдэлийн хуудсанд мэдэгдэх эсэхийг шалгана уу.`,
    );
  }
  return lines;
}

export function ensurePredictedAction(
  item: EmployeeVoiceItem,
  actions: VoiceAction[],
  newId: () => string,
) {
  const existing = actions.filter((a) => a.voiceId === item.id);
  if (existing.length > 0) return { item, actions, created: false };
  const predicted = predictAction(item);
  const now = new Date().toISOString();
  const action: VoiceAction = {
    id: newId(),
    voiceId: item.id,
    title: predicted.title,
    kind: "predicted",
    owner: item.assignedTo || "",
    dueDate: item.dueDate,
    progressPercent: 0,
    note: predicted.note,
    createdAt: now,
    updatedAt: now,
  };
  item.predictedAction = predicted.title;
  item.notifyRisk = item.notifyRisk || predicted.notifyRisk;
  item.notifyResearch = item.notifyResearch || predicted.notifyResearch;
  return { item, actions: [...actions, action], created: true };
}

export function noticeMessage(item: EmployeeVoiceItem, target: VoiceNotice["target"]) {
  const kind = VOICE_TYPE_LABELS[item.type];
  if (target === "risk") {
    return `${kind}: ${item.title}. Эрсдэлийн бүртгэлд оруулж, хариу арга хэмжээг хянана уу.`;
  }
  return `${kind}: ${item.title}. Судалгаа хөгжүүлэлтийн төсөл/асуулгатай холбож үргэлжлүүлнэ үү.`;
}
