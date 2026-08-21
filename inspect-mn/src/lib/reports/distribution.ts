import { sendTransactionalEmail } from "@/lib/email/resend";
import { buildPlatformReport } from "@/lib/reports/build";
import type {
  ReportChannelSchedule,
  ReportDistributionConfig,
  ReportFrequency,
} from "@/lib/reports/distribution-config";
import { writeReportDistributionConfig } from "@/lib/reports/distribution-store";
import { renderFormalReportPdf } from "@/lib/reports/export-pdf";
import { buildFormalReport, type FormalReport } from "@/lib/reports/formal-report";
import { escapeTelegramHtml, portalPublicUrl, sendTelegramMessage } from "@/lib/telegram/sendMessage";

type LocalParts = { year: number; month: number; day: number; hour: number; weekday: number };

function localParts(date: Date, timezone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "0";
  const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    hour: Number(value("hour")),
    weekday: weekdays[value("weekday")] ?? 0,
  };
}

export function reportPeriodKey(frequency: ReportFrequency, date: Date, timezone: string) {
  const p = localParts(date, timezone);
  const ymd = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  if (frequency === "daily") return `daily:${ymd}`;
  if (frequency === "weekly") return `weekly:${ymd}`;
  return `monthly:${p.year}-${String(p.month).padStart(2, "0")}`;
}

export function isReportScheduleDue(
  schedule: ReportChannelSchedule,
  lastPeriodKey: string,
  date: Date,
  timezone: string,
) {
  if (!schedule.enabled || schedule.recipients.length === 0) return false;
  const p = localParts(date, timezone);
  if (schedule.frequency === "weekly" && p.weekday !== schedule.dayOfWeek) return false;
  if (schedule.frequency === "monthly" && p.day !== schedule.dayOfMonth) return false;
  return reportPeriodKey(schedule.frequency, date, timezone) !== lastPeriodKey;
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function detailedEmailHtml(report: FormalReport) {
  const list = (items: string[]) => `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  const kpis = report.kpis
    .map((item) => `<tr><td>${escapeHtml(item.label)}</td><td style="text-align:right;font-weight:700">${escapeHtml(item.value)}</td><td>${escapeHtml(item.interpretation)}</td></tr>`)
    .join("");
  const findings = report.priorityFindings
    .slice(0, 12)
    .map((item) => `<tr><td>${escapeHtml(item.date)}</td><td>${escapeHtml(item.system)} / ${escapeHtml(item.unit)}</td><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.severity)}</td><td>${escapeHtml(item.status)} / ${escapeHtml(item.owner)}</td></tr>`)
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#0f172a"><div style="max-width:900px;margin:0 auto;padding:24px"><div style="background:#fff;border:1px solid #cbd5e1;border-radius:8px;padding:28px"><div style="color:#ea580c;font-size:12px;font-weight:700;letter-spacing:.12em">INSPECT-MN · BTEG</div><h1 style="font-size:22px;margin:8px 0 4px">${escapeHtml(report.title)}</h1><p style="color:#64748b;margin:0 0 18px">${escapeHtml(report.periodLabel)}</p><h2 style="font-size:16px;color:#ea580c">Удирдлагын хураангуй</h2>${list(report.executiveSummary)}<h2 style="font-size:16px;color:#ea580c">Гол KPI</h2><table style="width:100%;border-collapse:collapse" cellpadding="7" border="1"><thead><tr><th>Үзүүлэлт</th><th>Утга</th><th>Тайлбар</th></tr></thead><tbody>${kpis}</tbody></table><h2 style="font-size:16px;color:#ea580c">Суурь шалтгааны дохио</h2>${list(report.rootCauseSignals.map((item) => `${item.title}: ${item.evidence} (${item.method})`))}<p style="font-size:12px;color:#b45309">Эдгээр нь статистик indicator бөгөөд баталгаажсан root cause биш.</p><h2 style="font-size:16px;color:#ea580c">Нэн тэргүүний олдвор</h2><table style="width:100%;border-collapse:collapse;font-size:12px" cellpadding="6" border="1"><thead><tr><th>Огноо</th><th>Систем / нэгж</th><th>Олдвор</th><th>Эрсдэл</th><th>Төлөв / эзэн</th></tr></thead><tbody>${findings}</tbody></table><h2 style="font-size:16px;color:#ea580c">Зөвлөмж, арга хэмжээ</h2>${list(report.recommendations)}<p style="margin-top:24px"><a href="${portalPublicUrl()}/report-analysis/report" style="background:#ea580c;color:white;padding:10px 14px;border-radius:5px;text-decoration:none;font-weight:700">Тайланг порталаас харах</a></p><p style="color:#94a3b8;font-size:11px;margin-top:20px">PDF хавсралт нь үүсгэсэн үеийн албан тайлангийн snapshot болно.</p></div></div></body></html>`;
}

function telegramSummary(report: FormalReport) {
  const high = report.sourceSummary.reduce((sum, item) => sum + item.high, 0);
  const lines = [
    "<b>INSPECT-MN · Удирдлагын хураангуй</b>",
    escapeTelegramHtml(report.periodLabel),
    "",
    `<b>Нийт өндөр/ноцтой дохио:</b> ${high}`,
    `<b>Суурь шалтгааны indicator:</b> ${report.rootCauseSignals.length}`,
    `<b>Нэн тэргүүний олдвор:</b> ${report.priorityFindings.length}`,
    "",
    "<b>Гол дүгнэлт</b>",
    ...report.executiveSummary.slice(0, 4).map((item) => `• ${escapeTelegramHtml(item)}`),
    "",
    "<b>Шуурхай арга хэмжээ</b>",
    ...report.recommendations.slice(0, 3).map((item) => `• ${escapeTelegramHtml(item)}`),
    "",
    `<a href="${portalPublicUrl()}/report-analysis/report">Дэлгэрэнгүй тайлан</a>`,
  ];
  return lines.join("\n").slice(0, 4000);
}

export async function sendDetailedReportEmail(report: FormalReport, recipients: string[]) {
  const pdf = await renderFormalReportPdf(report);
  const results = [];
  for (const recipient of recipients) {
    results.push(
      await sendTransactionalEmail({
        to: recipient,
        subject: `INSPECT-MN нэгдсэн тайлан · ${report.generatedAt.slice(0, 10)}`,
        html: detailedEmailHtml(report),
        text: [...report.executiveSummary, "", ...report.recommendations].join("\n"),
        attachments: [
          {
            filename: `inspect-mn-formal-report-${report.generatedAt.slice(0, 10)}.pdf`,
            content: pdf.toString("base64"),
          },
        ],
      }),
    );
  }
  return results;
}

export async function sendTelegramReportSummary(report: FormalReport, chatIds: string[]) {
  const message = telegramSummary(report);
  return Promise.all(
    chatIds.map(async (chatId) => {
      try {
        await sendTelegramMessage(chatId, message);
        return { ok: true as const, chatId };
      } catch (error) {
        return {
          ok: false as const,
          chatId,
          error: error instanceof Error ? error.message : "Telegram илгээхэд алдаа",
        };
      }
    }),
  );
}

export async function buildDistributionReport() {
  return buildFormalReport(await buildPlatformReport(null));
}

export async function runScheduledReportDistribution(
  config: ReportDistributionConfig,
  options?: { now?: Date; forceChannel?: "email" | "telegram" },
) {
  const now = options?.now ?? new Date();
  const forceEmail = options?.forceChannel === "email";
  const forceTelegram = options?.forceChannel === "telegram";
  const emailDue = forceEmail || (!options?.forceChannel && isReportScheduleDue(config.detailedEmail, config.lastEmailPeriodKey, now, config.timezone));
  const telegramDue = forceTelegram || (!options?.forceChannel && isReportScheduleDue(config.telegramSummary, config.lastTelegramPeriodKey, now, config.timezone));
  if (!emailDue && !telegramDue) return { ok: true, skipped: true, config };

  const report = await buildDistributionReport();
  let next: ReportDistributionConfig = { ...config };
  const result: Record<string, unknown> = { ok: true, skipped: false };

  if (emailDue) {
    const sent = await sendDetailedReportEmail(report, config.detailedEmail.recipients);
    const failures = sent.filter((item) => !item.ok);
    const successCount = sent.length - failures.length;
    next = {
      ...next,
      lastEmailPeriodKey: successCount > 0
        ? reportPeriodKey(config.detailedEmail.frequency, now, config.timezone)
        : next.lastEmailPeriodKey,
      lastEmailStatus: failures.length ? `${successCount}/${sent.length} амжилттай` : `${sent.length} хүлээн авагчид илгээсэн`,
    };
    result.email = next.lastEmailStatus;
    if (successCount === 0) {
      result.ok = false;
      result.error = failures[0]?.error ?? "Email илгээж чадсангүй";
    }
  }
  if (telegramDue) {
    const sent = await sendTelegramReportSummary(report, config.telegramSummary.recipients);
    const failures = sent.filter((item) => !item.ok);
    const successCount = sent.length - failures.length;
    next = {
      ...next,
      lastTelegramPeriodKey: successCount > 0
        ? reportPeriodKey(config.telegramSummary.frequency, now, config.timezone)
        : next.lastTelegramPeriodKey,
      lastTelegramStatus: failures.length ? `${successCount}/${sent.length} chat амжилттай` : `${sent.length} chat-д илгээсэн`,
    };
    if (successCount === 0) {
      result.ok = false;
      result.error = failures[0]?.error ?? "Telegram илгээж чадсангүй";
    }
    result.telegram = next.lastTelegramStatus;
  }

  const saved = await writeReportDistributionConfig(next);
  return { ...result, config: saved };
}
