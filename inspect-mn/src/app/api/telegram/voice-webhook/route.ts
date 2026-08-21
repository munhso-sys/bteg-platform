import { NextResponse } from "next/server";
import {
  askOpenAi,
  buildAiContext,
  localHeuristicAnswer,
  openaiConfigured,
} from "@/lib/ai/context";
import { buildPlatformReport } from "@/lib/reports/build";
import {
  buildTelegramHelp,
  resolveTelegramCapabilities,
  type TelegramCapability,
} from "@/lib/telegram/bot-config";
import { readTelegramBotConfig } from "@/lib/telegram/bot-config-store";
import {
  escapeTelegramHtml,
  sendTelegramMessage,
  telegramToken,
} from "@/lib/telegram/sendMessage";
import { classifyVoiceText, predictAction } from "@/lib/voice/classify";
import { ensurePredictedAction } from "@/lib/voice/overview";
import { newId, updateVoiceDb } from "@/lib/voice/store";
import type { EmployeeVoiceItem, VoiceType } from "@/lib/voice/types";
import { VOICE_TYPE_LABELS } from "@/lib/voice/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPE_CMD: Record<string, VoiceType> = {
  санал: "suggestion",
  suggestion: "suggestion",
  suggest: "suggestion",
  хүсэлт: "request",
  huselt: "request",
  request: "request",
  гомдол: "complaint",
  gomdol: "complaint",
  complaint: "complaint",
  асуулга: "survey",
  asuulga: "survey",
  survey: "survey",
};

const AI_CMDS = new Set(["ai", "асуу", "asu", "assistant"]);
const REPORT_CMDS = new Set(["тайлан", "tailan", "report", "мэдээ", "medee"]);
const CAPS_CMDS = new Set(["эрх", "erh", "caps", "myid", "id"]);

/** Telegram menu/group cmds look like `/ai@MyBot` — strip bot suffix. */
function normalizeCmdToken(raw: string) {
  return raw
    .trim()
    .replace(/^\//, "")
    .split("@")[0]
    .toLowerCase();
}

function makeVoiceTitle(content: string, max = 200) {
  const oneLine = content.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return `${oneLine.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Slash cmds: strip `/cmd[@bot]` (and optional type for /voice|/anonymous).
 * Free text: keep the entire message (do not drop the first word).
 * Preserves newlines in the body.
 */
function parseCommand(text: string, anonymous: boolean) {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  const isSlash = trimmed.startsWith("/");

  if (!isSlash) {
    const classified = classifyVoiceText(trimmed);
    return {
      cmd: "",
      type: classified.type,
      priority: classified.priority,
      content: trimmed,
      anonymous,
    };
  }

  const match = trimmed.match(
    /^\/([^\s@]+)(?:@[^\s]+)?(?:\s+([\s\S]*))?$/,
  );
  const cmd = (match?.[1] || "").toLowerCase();
  let body = (match?.[2] || "").trim();
  let type: VoiceType | null = TYPE_CMD[cmd] || null;
  const isAnonymous = anonymous || cmd === "anonymous";

  if (cmd === "voice" || cmd === "anonymous") {
    const bodyMatch = body.match(/^([^\s]+)(?:\s+([\s\S]*))?$/);
    const maybeType = TYPE_CMD[normalizeCmdToken(bodyMatch?.[1] || "")];
    if (maybeType) {
      type = maybeType;
      body = (bodyMatch?.[2] || "").trim();
    }
  }

  const classified = classifyVoiceText(body);
  return {
    cmd,
    type: type || classified.type,
    priority: classified.priority,
    content: body,
    anonymous: isAnonymous,
  };
}

async function touchTelegramUser(params: {
  telegramId: string;
  username: string;
  fullName: string;
}) {
  const now = new Date().toISOString();
  await updateVoiceDb((db) => {
    const existing = db.telegramUsers.find(
      (u) => u.telegramId === params.telegramId,
    );
    if (existing) {
      existing.username = params.username || existing.username;
      existing.fullName = params.fullName || existing.fullName;
      existing.lastSeenAt = now;
    } else {
      db.telegramUsers.push({
        telegramId: params.telegramId,
        username: params.username,
        fullName: params.fullName,
        lastSeenAt: now,
        createdAt: now,
      });
    }
  });
}

function denyMessage(cap: TelegramCapability) {
  const labels: Record<TelegramCapability, string> = {
    "voice.submit": "санал/хүсэлт/гомдол илгээх",
    "voice.anonymous": "нэргүй илгээх",
    "ai.ask": "AI туслах",
    "reports.overview": "тайлан мэдээ",
  };
  return `⛔ Танд <b>${escapeTelegramHtml(labels[cap])}</b> эрх байхгүй.\nУдирдлагын төв → Telegram бот тохиргооноос эрх авна уу.`;
}

async function handleAiAsk(chatId: string, question: string) {
  if (!question) {
    await sendTelegramMessage(
      chatId,
      "Ашиглалт: <code>/ai [асуулт]</code>\nЖишээ: <code>/ai Өнөөдрийн гол эрсдэл юу вэ?</code>",
    );
    return;
  }
  const context = await buildAiContext("general", null, { query: question });
  const answer = openaiConfigured()
    ? await askOpenAi({ message: question, context, history: [] })
    : localHeuristicAnswer(question, context);
  const body = escapeTelegramHtml(answer).slice(0, 3500);
  await sendTelegramMessage(
    chatId,
    `<b>AI туслах</b>\n\n${body}`,
  );
}

async function handleReport(chatId: string) {
  const report = await buildPlatformReport();
  const kpiLines = report.kpis.slice(0, 8).map(
    (k) =>
      `• <b>${escapeTelegramHtml(k.label)}</b>: ${escapeTelegramHtml(k.value)}`,
  );
  const conclusions = report.conclusions
    .slice(0, 5)
    .map((c) => `• ${escapeTelegramHtml(c)}`);
  const text = [
    `<b>${escapeTelegramHtml(report.title || "Платформын тайлан")}</b>`,
    `<i>${escapeTelegramHtml(new Date(report.generatedAt).toLocaleString("mn-MN"))}</i>`,
    "",
    "<b>KPI</b>",
    ...kpiLines,
    "",
    "<b>Дүгнэлт</b>",
    ...(conclusions.length ? conclusions : ["• Мэдээлэл алга"]),
  ].join("\n");
  await sendTelegramMessage(chatId, text.slice(0, 3900));
}

export async function POST(req: Request) {
  if (!telegramToken()) {
    return NextResponse.json({ ok: true, skipped: "no token" });
  }

  const body = (await req.json()) as {
    message?: {
      text?: string;
      chat?: { id?: number };
      from?: {
        id?: number;
        username?: string;
        first_name?: string;
        last_name?: string;
      };
    };
  };

  const message = body.message;
  const text = message?.text?.trim();
  const chatId = String(message?.chat?.id || "");
  if (!text || !chatId) return NextResponse.json({ ok: true });

  const telegramId = String(message?.from?.id || chatId);
  const username = message?.from?.username || "";
  const fullName = [message?.from?.first_name, message?.from?.last_name]
    .filter(Boolean)
    .join(" ");

  try {
    const config = await readTelegramBotConfig({ fresh: true });
    const caps = resolveTelegramCapabilities(config, telegramId);

    if (text === "/start" || text === "/help" || text.startsWith("/start@") || text.startsWith("/help@")) {
      await touchTelegramUser({ telegramId, username, fullName });
      const help = [
        buildTelegramHelp(caps),
        "",
        `<i>Таны ID: ${escapeTelegramHtml(telegramId)}</i>`,
        caps.has("ai.ask") || caps.has("reports.overview")
          ? "<i>Нэмэлт эрх идэвхтэй.</i>"
          : "",
      ]
        .filter(Boolean)
        .join("\n");
      await sendTelegramMessage(chatId, help);
      return NextResponse.json({ ok: true });
    }

    const parsed = parseCommand(text, false);
    const isSlash = text.startsWith("/");

    if (isSlash && CAPS_CMDS.has(parsed.cmd)) {
      await touchTelegramUser({ telegramId, username, fullName });
      const list = [...caps]
        .map((c) => `• ${escapeTelegramHtml(c)}`)
        .join("\n");
      await sendTelegramMessage(
        chatId,
        `<b>Таны Telegram эрх</b>\nID: <code>${escapeTelegramHtml(telegramId)}</code>\n\n${list || "• эрх алга"}`,
      );
      return NextResponse.json({ ok: true });
    }

    if (isSlash && AI_CMDS.has(parsed.cmd)) {
      if (!caps.has("ai.ask")) {
        await sendTelegramMessage(chatId, denyMessage("ai.ask"));
        return NextResponse.json({ ok: true });
      }
      await touchTelegramUser({ telegramId, username, fullName });
      await handleAiAsk(chatId, parsed.content);
      return NextResponse.json({ ok: true });
    }

    if (isSlash && REPORT_CMDS.has(parsed.cmd)) {
      if (!caps.has("reports.overview")) {
        await sendTelegramMessage(chatId, denyMessage("reports.overview"));
        return NextResponse.json({ ok: true });
      }
      await touchTelegramUser({ telegramId, username, fullName });
      await handleReport(chatId);
      return NextResponse.json({ ok: true });
    }

    if (!parsed.content && isSlash) {
      await sendTelegramMessage(chatId, buildTelegramHelp(caps));
      return NextResponse.json({ ok: true });
    }
    if (!parsed.content) return NextResponse.json({ ok: true });

    if (!caps.has("voice.submit")) {
      await sendTelegramMessage(chatId, denyMessage("voice.submit"));
      return NextResponse.json({ ok: true });
    }
    if (parsed.anonymous && !caps.has("voice.anonymous")) {
      await sendTelegramMessage(chatId, denyMessage("voice.anonymous"));
      return NextResponse.json({ ok: true });
    }

    const now = new Date().toISOString();
    const fullText = parsed.content;
    const title = makeVoiceTitle(fullText);
    const predicted = predictAction({
      type: parsed.type,
      priority: parsed.priority,
      title,
    });
    const item: EmployeeVoiceItem = {
      id: newId(),
      type: parsed.type,
      title,
      description: fullText,
      status: "new",
      priority: parsed.priority,
      department: "",
      submittedBy: parsed.anonymous
        ? "Нэргүй"
        : fullName || username || telegramId,
      assignedTo: "",
      source: "telegram",
      isAnonymous: parsed.anonymous,
      telegramId: parsed.anonymous ? null : telegramId,
      dueDate: null,
      voiceDate: now.slice(0, 10),
      actionTaken: "",
      analysisNote: "",
      predictedAction: predicted.title,
      notifyRisk: predicted.notifyRisk,
      notifyResearch: predicted.notifyResearch,
      surveyTopic: parsed.type === "survey" ? makeVoiceTitle(fullText, 120) : "",
      createdAt: now,
      updatedAt: now,
    };

    await updateVoiceDb((db) => {
      const ensured = ensurePredictedAction(item, db.actions, newId);
      db.items.unshift(ensured.item);
      db.actions = ensured.actions;
      const existing = db.telegramUsers.find((u) => u.telegramId === telegramId);
      if (existing) {
        existing.username = username;
        existing.fullName = fullName;
        existing.lastSeenAt = now;
      } else {
        db.telegramUsers.push({
          telegramId,
          username,
          fullName,
          lastSeenAt: now,
          createdAt: now,
        });
      }
    });

    const preview = escapeTelegramHtml(fullText);
    const previewLimit = 3500;
    const shown =
      preview.length > previewLimit
        ? `${preview.slice(0, previewLimit)}…`
        : preview;
    await sendTelegramMessage(
      chatId,
      `✅ <b>${escapeTelegramHtml(VOICE_TYPE_LABELS[parsed.type])} бүртгэгдлээ</b> · ${fullText.length} тэмдэгт\n\n${shown}\n\nТаамагласан арга хэмжээ: ${escapeTelegramHtml(predicted.title)}`,
    );
  } catch (err) {
    console.error("telegram voice webhook", err);
    try {
      await sendTelegramMessage(
        chatId,
        `Алдаа: ${escapeTelegramHtml(err instanceof Error ? err.message : "unknown")}`,
      );
    } catch {
      // ignore
    }
  }

  return NextResponse.json({ ok: true });
}
