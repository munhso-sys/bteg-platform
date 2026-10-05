import { NextResponse } from "next/server";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { getPolicyDetail } from "@/lib/db/repository";
import {
  buildPolicyDocumentModel,
  buildWordBuffer,
  renderFormalPolicyHtml,
  utf8Filename,
} from "@/lib/policy-document";
import { renderFormalPolicyPdf } from "@/lib/policy-document-pdf";
import {
  escapeTelegramHtml,
  sendTelegramDocument,
  sendTelegramMessage,
  telegramToken,
} from "@/lib/telegram/sendMessage";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

type ShareChannel = "email" | "telegram";
type ShareFormat = "word" | "pdf";

type ShareBody = {
  channel?: ShareChannel;
  formats?: ShareFormat[];
  recipients?: string[];
  previewUrl?: string;
};

type ShareResult = {
  recipient: string;
  ok: boolean;
  error?: string;
  skipped?: boolean;
};

function parseRecipients(raw: string[] | undefined): string[] {
  if (!raw?.length) return [];
  const out: string[] = [];
  for (const entry of raw) {
    for (const part of String(entry).split(/[\s,;]+/)) {
      const value = part.trim();
      if (value) out.push(value);
    }
  }
  return [...new Set(out)];
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: ShareBody;
  try {
    body = (await request.json()) as ShareBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "JSON бие буруу" },
      { status: 400 },
    );
  }

  const channel = body.channel;
  const formats = [...new Set((body.formats ?? []).filter(Boolean))];
  const recipients = parseRecipients(body.recipients);

  if (channel !== "email" && channel !== "telegram") {
    return NextResponse.json(
      { ok: false, error: "channel: email | telegram" },
      { status: 400 },
    );
  }
  if (!formats.length || formats.some((f) => f !== "word" && f !== "pdf")) {
    return NextResponse.json(
      { ok: false, error: "formats: word | pdf" },
      { status: 400 },
    );
  }
  if (!recipients.length) {
    return NextResponse.json(
      { ok: false, error: "recipients шаардлагатай" },
      { status: 400 },
    );
  }

  const detail = await getPolicyDetail(id);
  if (!detail) {
    return NextResponse.json(
      { ok: false, error: "Журам олдсонгүй" },
      { status: 404 },
    );
  }

  const model = buildPolicyDocumentModel(detail);
  const title = detail.policy.name;
  const subject = `Журам — ${title}`;
  const previewUrl = body.previewUrl?.trim() || "";

  const attachments: Array<{
    filename: string;
    contentType: string;
    bytes: Buffer;
  }> = [];

  try {
    if (formats.includes("word")) {
      const html = renderFormalPolicyHtml(model);
      attachments.push({
        filename: utf8Filename(title, "doc"),
        contentType: "application/msword",
        bytes: buildWordBuffer(html),
      });
    }
    if (formats.includes("pdf")) {
      const pdfBytes = await renderFormalPolicyPdf(model);
      attachments.push({
        filename: utf8Filename(title, "pdf"),
        contentType: "application/pdf",
        bytes: pdfBytes,
      });
    }
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Журмын файл үүсгэхэд алдаа",
      },
      { status: 500 },
    );
  }

  const totalBytes = attachments.reduce((sum, a) => sum + a.bytes.length, 0);
  if (totalBytes > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: `Хавсралт хэтэрхий том (${Math.round(totalBytes / (1024 * 1024))}MB). 8MB-аас бага болгоно уу.`,
      },
      { status: 413 },
    );
  }

  const results: ShareResult[] = [];

  if (channel === "email") {
    const htmlBody = `
      <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#0f172a">
        <h2 style="margin:0 0 8px">Журмын баримт</h2>
        <p style="margin:0 0 4px"><b>Нэр:</b> ${escapeHtml(title)}</p>
        ${
          detail.policy.reference_code
            ? `<p style="margin:0 0 4px"><b>Код:</b> ${escapeHtml(detail.policy.reference_code)}</p>`
            : ""
        }
        ${
          previewUrl
            ? `<p style="margin:12px 0 0"><a href="${escapeHtml(previewUrl)}">Онлайнаар үзэх</a></p>`
            : ""
        }
        <p style="margin:12px 0 0;color:#64748b;font-size:13px">Журмын файл хавсаргав.</p>
      </div>
    `;
    const textBody = [
      "Журмын баримт",
      `Нэр: ${title}`,
      detail.policy.reference_code
        ? `Код: ${detail.policy.reference_code}`
        : null,
      previewUrl ? `Холбоос: ${previewUrl}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    for (const to of recipients) {
      const mailed = await sendTransactionalEmail({
        to,
        subject,
        html: htmlBody,
        text: textBody,
        attachments: attachments.map((a) => ({
          filename: a.filename,
          content: a.bytes.toString("base64"),
        })),
      });
      results.push({
        recipient: to,
        ok: mailed.ok,
        error: mailed.ok ? undefined : mailed.error,
        skipped: mailed.ok ? undefined : mailed.skipped,
      });
    }
  } else {
    if (!telegramToken()) {
      return NextResponse.json(
        { ok: false, error: "TELEGRAM_BOT_TOKEN тохируулаагүй" },
        { status: 503 },
      );
    }

    const caption = [
      `<b>${escapeTelegramHtml("Журмын баримт")}</b>`,
      `Нэр: ${escapeTelegramHtml(title)}`,
      detail.policy.reference_code
        ? `Код: ${escapeTelegramHtml(detail.policy.reference_code)}`
        : null,
      previewUrl ? `Холбоос: ${escapeTelegramHtml(previewUrl)}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    for (const chatId of recipients) {
      try {
        await sendTelegramMessage(chatId, caption);
        for (const file of attachments) {
          await sendTelegramDocument({
            chatId,
            filename: file.filename,
            bytes: file.bytes,
            contentType: file.contentType,
            caption: escapeTelegramHtml(file.filename),
          });
        }
        results.push({ recipient: chatId, ok: true });
      } catch (error) {
        results.push({
          recipient: chatId,
          ok: false,
          error: error instanceof Error ? error.message : "Telegram алдаа",
        });
      }
    }
  }

  const ok = results.some((r) => r.ok);
  return NextResponse.json({
    ok,
    results,
    error: ok
      ? undefined
      : results.find((r) => r.error)?.error || "Илгээхэд алдаа",
  });
}
