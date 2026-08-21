export const REPORT_DISTRIBUTION_CONFIG_KEY = "platform_report_distribution";

export const REPORT_FREQUENCIES = ["daily", "weekly", "monthly"] as const;
export type ReportFrequency = (typeof REPORT_FREQUENCIES)[number];

export type ReportChannelSchedule = {
  enabled: boolean;
  frequency: ReportFrequency;
  hour: number;
  dayOfWeek: number;
  dayOfMonth: number;
  recipients: string[];
};

export type ReportDistributionConfig = {
  timezone: string;
  detailedEmail: ReportChannelSchedule;
  telegramSummary: ReportChannelSchedule;
  lastEmailPeriodKey: string;
  lastTelegramPeriodKey: string;
  lastEmailStatus: string;
  lastTelegramStatus: string;
  updatedAt: string;
};

export const DEFAULT_REPORT_DISTRIBUTION_CONFIG: ReportDistributionConfig = {
  timezone: "Asia/Ulaanbaatar",
  detailedEmail: {
    enabled: false,
    frequency: "weekly",
    hour: 9,
    dayOfWeek: 1,
    dayOfMonth: 1,
    recipients: [],
  },
  telegramSummary: {
    enabled: false,
    frequency: "daily",
    hour: 9,
    dayOfWeek: 1,
    dayOfMonth: 1,
    recipients: [],
  },
  lastEmailPeriodKey: "",
  lastTelegramPeriodKey: "",
  lastEmailStatus: "Илгээгээгүй",
  lastTelegramStatus: "Илгээгээгүй",
  updatedAt: new Date(0).toISOString(),
};

function frequency(value: unknown, fallback: ReportFrequency): ReportFrequency {
  return typeof value === "string" && (REPORT_FREQUENCIES as readonly string[]).includes(value)
    ? (value as ReportFrequency)
    : fallback;
}

function list(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))].slice(0, 50);
}

function schedule(raw: unknown, fallback: ReportChannelSchedule): ReportChannelSchedule {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const hour = Math.min(23, Math.max(0, Number(obj.hour ?? fallback.hour) || 0));
  const dayOfWeek = Math.min(6, Math.max(0, Number(obj.dayOfWeek ?? fallback.dayOfWeek) || 0));
  const dayOfMonth = Math.min(28, Math.max(1, Number(obj.dayOfMonth ?? fallback.dayOfMonth) || 1));
  return {
    enabled: obj.enabled === true,
    frequency: frequency(obj.frequency, fallback.frequency),
    hour,
    dayOfWeek,
    dayOfMonth,
    recipients: list(obj.recipients),
  };
}

export function normalizeReportDistributionConfig(raw: unknown): ReportDistributionConfig {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    timezone: String(obj.timezone ?? DEFAULT_REPORT_DISTRIBUTION_CONFIG.timezone).trim() || DEFAULT_REPORT_DISTRIBUTION_CONFIG.timezone,
    detailedEmail: schedule(obj.detailedEmail, DEFAULT_REPORT_DISTRIBUTION_CONFIG.detailedEmail),
    telegramSummary: schedule(obj.telegramSummary, DEFAULT_REPORT_DISTRIBUTION_CONFIG.telegramSummary),
    lastEmailPeriodKey: String(obj.lastEmailPeriodKey ?? ""),
    lastTelegramPeriodKey: String(obj.lastTelegramPeriodKey ?? ""),
    lastEmailStatus: String(obj.lastEmailStatus ?? DEFAULT_REPORT_DISTRIBUTION_CONFIG.lastEmailStatus),
    lastTelegramStatus: String(obj.lastTelegramStatus ?? DEFAULT_REPORT_DISTRIBUTION_CONFIG.lastTelegramStatus),
    updatedAt: typeof obj.updatedAt === "string" ? obj.updatedAt : new Date().toISOString(),
  };
}

