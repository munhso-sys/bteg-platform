import { NextResponse } from "next/server";
import { requireInspectionWriteAccess } from "@/lib/access/scope";
import { sendTransactionalEmail } from "@/lib/email/resend";
import {
  escapeTelegramHtml,
  sendTelegramDocument,
  sendTelegramMessage,
  telegramToken,
} from "@/lib/telegram/sendMessage";
import type { ConsolidatedReport } from "@/lib/runs/consolidated-report";
import {
  buildConsolidatedReportHtml,
  type ConsolidatedReportExportInput,
} from "@/lib/runs/export-consolidated-word";
import { renderConsolidatedReportPdf } from "@/lib/runs/export-consolidated-pdf";

export const runtime = "nodejs";

const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

type ShareChannel = "email" | "telegram";
type ShareFormat = "word" | "pdf";

type ShareBody = {
  channel?: ShareChannel;
  formats?: ShareFormat[];
  recipients?: string[];
  report?: ConsolidatedReport;
  runTitle?: string;
  inspectionDate?: string;
  inspectedByOrg?: string;
  performers?: Array<{ name: string; position: string }>;
  inspectionType?: "JOINT_INSPECTION" | "NIGHT_INSPECTION";
  filename?: string;
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

function stripImgTags(html: string) {
  return html.replace(/<img\b[^>]*>/gi, "зураг");
}

function buildWordBuffer(html: string): Buffer {
  const bom = Buffer.from([0xef, 0xbb, 0xbf]);
  return Buffer.concat([bom, Buffer.from(html, "utf8")]);
}

function baseName(filename?: string) {
  const raw = (filename || "ul-tohirol").trim() || "ul-tohirol";
  return raw.replace(/\.docx?$/i, "").replace(/\.pdf$/i, "");
}

function summarizeReport(input: ConsolidatedReportExportInput) {
  const isNight = input.inspectionType === "NIGHT_INSPECTION";
  const title = isNight
    ? "Шөнийн хяналт шалгалтын тайлан"
    : "Хамтарсан хяналт шалгалтын тайлан";
  const violations = input.report.nonConformities?.length ?? 0;
  const categories = input.report.byCategory.length;
  return {
    title,
    subject: `${title} — ${input.runTitle}`,
    lines: [
      title,
      `Гарчиг: ${input.runTitle}`,
      `Огноо: ${input.inspectionDate}`,
      `Зөрчил: ${violations}`,
      `Ангилал: ${categories}`,
    ],
  };
}

export async function POST(request: Request) {
  const gate = await requireInspectionWriteAccess();
  if (gate.error) return gate.error;

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
  if (!body.report || !body.runTitle || !body.inspectionDate) {
    return NextResponse.json(
      { ok: false, error: "report, runTitle, inspectionDate шаардлагатай" },
      { status: 400 },
    );
  }

  const exportInput: ConsolidatedReportExportInput = {
    report: body.report,
    runTitle: body.runTitle,
    inspectionDate: body.inspectionDate,
    inspectedByOrg: body.inspectedByOrg,
    performers: body.performers,
    inspectionType: body.inspectionType,
    filename: body.filename,
  };

  const name = baseName(body.filename);
  const attachments: Array<{
    filename: string;
    contentType: string;
    bytes: Buffer;
  }> = [];

  try {
    if (formats.includes("word")) {
      let html = buildConsolidatedReportHtml(exportInput);
      let wordBytes = buildWordBuffer(html);
      if (wordBytes.length > MAX_ATTACHMENT_BYTES) {
        html = stripImgTags(html);
        wordBytes = buildWordBuffer(html);
      }
      attachments.push({
        filename: `${name}.doc`,
        contentType: "application/msword",
        bytes: wordBytes,
      });
    }

    if (formats.includes("pdf")) {
      const pdfBytes = await renderConsolidatedReportPdf(exportInput);
      attachments.push({
        filename: `${name}.pdf`,
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
            : "Тайлан файл үүсгэхэд алдаа",
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

  const summary = summarizeReport(exportInput);
  const results: ShareResult[] = [];

  if (channel === "email") {
    const htmlBody = `
      <div style="font-family:Segoe UI,Arial,sans-serif;line-height:1.5;color:#0f172a">
        <h2 style="margin:0 0 8px">${escapeHtml(summary.title)}</h2>
        <p style="margin:0 0 4px"><b>Гарчиг:</b> ${escapeHtml(exportInput.runTitle)}</p>
        <p style="margin:0 0 4px"><b>Огноо:</b> ${escapeHtml(exportInput.inspectionDate)}</p>
        <p style="margin:0 0 4px"><b>Зөрчил:</b> ${exportInput.report.nonConformities?.length ?? 0}</p>
        <p style="margin:12px 0 0;color:#64748b;font-size:13px">Үл тохирлын тайлан хавсаргав.</p>
      </div>
    `;
    const textBody = summary.lines.join("\n");

    for (const to of recipients) {
      const mailed = await sendTransactionalEmail({
        to,
        subject: summary.subject,
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
      `<b>${escapeTelegramHtml(summary.title)}</b>`,
      `Гарчиг: ${escapeTelegramHtml(exportInput.runTitle)}`,
      `Огноо: ${escapeTelegramHtml(exportInput.inspectionDate)}`,
      `Зөрчил: ${exportInput.report.nonConformities?.length ?? 0}`,
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
    error: ok ? undefined : results.find((r) => r.error)?.error || "Илгээхэд алдаа",
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
