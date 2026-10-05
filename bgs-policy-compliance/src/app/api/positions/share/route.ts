import { NextResponse } from "next/server";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { getPositionDetail } from "@/lib/db/repository";
import { listPositionsForReview } from "@/lib/db/org";
import {
  buildPositionPreviewWordBuffer,
  positionPreviewExportFilename,
} from "@/lib/position-preview-document";
import { renderPositionPreviewPdf } from "@/lib/position-preview-document-pdf";
import { buildPositionPreviewExportModel } from "@/lib/position-preview-export";
import {
  buildPositionReviewWordBuffer,
  filterPositionReviewRows,
  scopeTitle,
  type PositionReviewScope,
} from "@/lib/position-review-document";
import { renderPositionReviewPdf } from "@/lib/position-review-document-pdf";
import {
  escapeTelegramHtml,
  sendTelegramDocument,
  sendTelegramMessage,
  telegramToken,
} from "@/lib/telegram/sendMessage";
import { utf8Filename } from "@/lib/policy-document";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

type ShareChannel = "email" | "telegram";
type ShareFormat = "word" | "pdf";

type ShareBody = {
  channel?: ShareChannel;
  formats?: ShareFormat[];
  recipients?: string[];
  scope?: PositionReviewScope;
  positionId?: string;
  previewUrl?: string;
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

export async function POST(request: Request) {
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
  const scope = body.scope ?? {};
  const positionId = body.positionId?.trim() || null;

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

  const attachments: Array<{
    filename: string;
    contentType: string;
    bytes: Buffer;
  }> = [];

  let title = "";
  let countLabel = "";

  try {
    if (positionId) {
      const detail = await getPositionDetail(positionId);
      if (!detail) {
        return NextResponse.json(
          { ok: false, error: "Ажлын байр олдсонгүй" },
          { status: 404 },
        );
      }
      const reviewRows = await listPositionsForReview();
      const reviewRow =
        reviewRows.find((r) => r.id === detail.position.id) ?? null;
      const model = buildPositionPreviewExportModel(detail, reviewRow);
      title = `${model.position.name} — шалгалт`;
      countLabel = "1 ажлын байр";
      const docName = positionPreviewExportFilename(model);
      const pdfName = utf8Filename(title.slice(0, 60), "pdf");

      if (formats.includes("word")) {
        attachments.push({
          filename: docName,
          contentType: "application/msword",
          bytes: buildPositionPreviewWordBuffer(model),
        });
      }
      if (formats.includes("pdf")) {
        attachments.push({
          filename: pdfName,
          contentType: "application/pdf",
          bytes: await renderPositionPreviewPdf(model),
        });
      }
    } else {
      const all = await listPositionsForReview(scope.q);
      const rows = filterPositionReviewRows(all, scope);
      title = scopeTitle(scope);
      countLabel = `${rows.length} ажлын байр`;
      const docName = utf8Filename(title.slice(0, 60), "doc");
      const pdfName = utf8Filename(title.slice(0, 60), "pdf");

      if (formats.includes("word")) {
        attachments.push({
          filename: docName,
          contentType: "application/msword",
          bytes: buildPositionReviewWordBuffer(rows, scope),
        });
      }
      if (formats.includes("pdf")) {
        attachments.push({
          filename: pdfName,
          contentType: "application/pdf",
          bytes: await renderPositionReviewPdf(rows, scope),
        });
      }
    }
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Файл үүсгэхэд алдаа",
      },
      { status: 500 },
    );
  }

  const totalBytes = attachments.reduce((sum, a) => sum + a.bytes.length, 0);
  if (totalBytes > MAX_ATTACHMENT_BYTES) {
    return NextResponse.json(
      {
        ok: false,
        error: `Хавсралт хэтэрхий том (${Math.round(totalBytes / (1024 * 1024))}MB).`,
      },
      { status: 413 },
    );
  }

  const results: Array<{
    recipient: string;
    ok: boolean;
    error?: string;
    skipped?: boolean;
  }> = [];

  if (channel === "email") {
    const htmlBody = `
      <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#0f172a">
        <h2 style="margin:0 0 8px">${positionId ? "Ажлын байрны шалгалт" : "Ажлын байрын жагсаалт"}</h2>
        <p style="margin:0 0 4px"><b>Гарчиг:</b> ${escapeHtml(title)}</p>
        <p style="margin:0 0 4px"><b>Тоо:</b> ${escapeHtml(countLabel)}</p>
        ${body.previewUrl ? `<p style="margin:12px 0 0"><a href="${escapeHtml(body.previewUrl)}">Онлайнаар үзэх</a></p>` : ""}
      </div>
    `;
    const textBody = [title, countLabel, body.previewUrl ?? ""]
      .filter(Boolean)
      .join("\n");

    for (const to of recipients) {
      const mailed = await sendTransactionalEmail({
        to,
        subject: positionId
          ? `Шалгалт — ${title}`
          : `Ажлын байр — ${title}`,
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
      `<b>${escapeTelegramHtml(
        positionId ? "Ажлын байрны шалгалт" : "Ажлын байрын жагсаалт",
      )}</b>`,
      `Гарчиг: ${escapeTelegramHtml(title)}`,
      `Тоо: ${escapeTelegramHtml(countLabel)}`,
    ].join("\n");

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
