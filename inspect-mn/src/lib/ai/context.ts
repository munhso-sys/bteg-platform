import { buildPlatformReport } from "@/lib/reports/build";
import type { PlatformReport } from "@/lib/reports/types";
import type { AiChatModule } from "@/lib/ai/types";
import type { AiResolvedScope } from "@/lib/ai/resolve-scope";
import { buildAiModuleFacts } from "@/lib/ai/module-facts";
import type { AiDataSource } from "@/lib/ai/scope-config";

export type { AiChatModule } from "@/lib/ai/types";

export type AiContextBundle = {
  generatedAt: string;
  module: AiChatModule;
  summaryText: string;
  kpis: Array<{ label: string; value: string; hint: string }>;
  highlights: string[];
  sourceErrors: Record<string, string>;
  openaiConfigured: boolean;
  scopeNote: string;
  scopeMode: AiResolvedScope["mode"];
};

const MODULE_SYSTEM_FILTER: Partial<Record<AiChatModule, string[]>> = {
  inspection: ["Хяналт шалгалт"],
  policy: ["Журмын биелэлт"],
  development: ["Судалгаа хөгжүүлэлт"],
  voice: ["Ажилтны дуу хоолой"],
  risk: ["Эрсдэл", "Гүйцэтгэл"],
  reports: ["Платформ", "Хандалт", "Эрсдэл", "Гүйцэтгэл"],
};

const MODULE_TO_SOURCE: Partial<Record<AiChatModule, AiDataSource>> = {
  inspection: "inspection",
  policy: "policy",
  development: "development",
  voice: "voice",
  risk: "risk",
  smartmine: "smartmine",
  reports: "reports",
};

function trimText(value: string, max = 280) {
  const t = value.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export function openaiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function buildAiContext(
  module: AiChatModule = "general",
  scope?: AiResolvedScope | null,
  options?: { query?: string | null },
): Promise<AiContextBundle> {
  const resolved: AiResolvedScope =
    scope ??
    ({
      mode: "all",
      unitScope: {
        active: false,
        heltesId: null,
        albaId: null,
        heltesName: null,
        albaName: null,
        labels: [],
      },
      sources: [
        "policy",
        "policy_content",
        "inspection",
        "inspection_detail",
        "development",
        "guidance",
        "voice",
        "risk",
        "reports",
        "smartmine",
        "people",
      ],
      roleId: null,
      scopeNote: "Бүх алба/хэлтэсийн платформын мэдээлэл",
    } satisfies AiResolvedScope);

  const unitForReport =
    resolved.mode === "unit" ? resolved.unitScope : null;

  const needReport =
    resolved.mode !== "none" &&
    (resolved.sources.includes("reports") ||
      resolved.sources.includes("risk") ||
      resolved.sources.includes("voice") ||
      resolved.sources.includes("people") ||
      resolved.sources.includes("development"));

  const [report, facts] = await Promise.all([
    needReport
      ? buildPlatformReport(unitForReport)
      : Promise.resolve(null as PlatformReport | null),
    buildAiModuleFacts(resolved, options?.query, module),
  ]);

  const base = report
    ? summarizeReport(report, module, resolved)
    : emptyBundle(module, resolved);

  const filteredKpis = filterKpisBySources(
    [...facts.kpis, ...base.kpis],
    module,
    resolved,
  );

  const contentHighlights = facts.lines.filter(
    (line) =>
      line.startsWith("Заалт ") ||
      line.startsWith("Журам:") ||
      line.startsWith("Олдвор:"),
  );

  const summaryText = [
    `Огноо: ${base.generatedAt}`,
    `Модуль шүүлт: ${module}`,
    `Хандалтын хүрээ: ${resolved.scopeNote}`,
    `Горим: ${resolved.mode}`,
    `Эрх (role): ${resolved.roleId ?? "—"}`,
    "",
    "Модулийн баримт тоо:",
    ...facts.lines,
    "",
    base.summaryText,
  ].join("\n");

  return {
    ...base,
    summaryText,
    kpis: filteredKpis.slice(0, 16),
    highlights: [
      ...contentHighlights.slice(0, 8),
      ...facts.lines.slice(0, 4),
      ...base.highlights,
    ].slice(0, 16),
    sourceErrors: { ...base.sourceErrors, ...facts.sourceErrors },
    scopeNote: resolved.scopeNote,
    scopeMode: resolved.mode,
  };
}

function emptyBundle(
  module: AiChatModule,
  scope: AiResolvedScope,
): AiContextBundle {
  return {
    generatedAt: new Date().toISOString(),
    module,
    summaryText: [
      `Огноо: ${new Date().toISOString()}`,
      `Модуль шүүлт: ${module}`,
      `Хандалтын хүрээ: ${scope.scopeNote}`,
      "",
      "Нэгжийн мэдээлэл байхгүй эсвэл эх систем унтраасан.",
    ].join("\n"),
    kpis: [],
    highlights: [],
    sourceErrors: {},
    openaiConfigured: openaiConfigured(),
    scopeNote: scope.scopeNote,
    scopeMode: scope.mode,
  };
}

function filterKpisBySources(
  kpis: Array<{ label: string; value: string; hint: string }>,
  module: AiChatModule,
  scope: AiResolvedScope,
) {
  const source = MODULE_TO_SOURCE[module];
  if (source && !scope.sources.includes(source) && module !== "general") {
    return kpis.filter((k) => /бүртгэгдсэн журам|шалгалт|заалт/i.test(k.label));
  }
  return kpis;
}

export function summarizeReport(
  report: PlatformReport,
  module: AiChatModule,
  scope?: AiResolvedScope | null,
): AiContextBundle {
  const systems = MODULE_SYSTEM_FILTER[module];
  const kpis = report.kpis
    .filter((k) => !systems || systems.includes(k.system))
    .slice(0, 12)
    .map((k) => ({ label: k.label, value: k.value, hint: k.hint }));

  const rows = report.rows
    .filter((r) => !systems || systems.some((s) => r.system.includes(s) || s.includes(r.system)))
    .slice(0, 12);

  const highlights: string[] = [];
  for (const line of report.conclusions.slice(0, 5)) {
    highlights.push(line);
  }
  for (const row of rows.slice(0, 8)) {
    highlights.push(
      `${row.system}: ${row.title} · ${row.value} · ${row.status} · ${row.owner || "—"}`,
    );
  }
  if (module === "voice" || module === "general") {
    for (const theme of report.voiceThemes.slice(0, 5)) {
      highlights.push(`Дуу хоолойн сэдэв: ${theme.label} (${theme.count})`);
    }
  }
  for (const unit of report.units.slice(0, 5)) {
    highlights.push(
      `Нэгж ${unit.unit}: дохио ${unit.signals}, өндөр ${unit.high}, хэтэрсэн ${unit.overdue}, үлдэгдэл ${unit.residual}%`,
    );
  }

  const scopeNote = scope?.scopeNote ?? "Бүх алба/хэлтэсийн платформын мэдээлэл";

  const summaryText = [
    `Огноо: ${report.generatedAt}`,
    `Модуль шүүлт: ${module}`,
    `Хандалтын хүрээ: ${scopeNote}`,
    "",
    "KPI:",
    ...kpis.map((k) => `- ${k.label}: ${k.value} (${k.hint})`),
    "",
    "Онцлох мэдээлэл:",
    ...highlights.map((h) => `- ${trimText(h, 220)}`),
    "",
    "Эх системийн алдаа:",
    ...Object.entries(report.sourceErrors).map(
      ([key, err]) => `- ${key}: ${err}`,
    ),
  ].join("\n");

  return {
    generatedAt: report.generatedAt,
    module,
    summaryText,
    kpis,
    highlights: highlights.slice(0, 12),
    sourceErrors: report.sourceErrors,
    openaiConfigured: openaiConfigured(),
    scopeNote,
    scopeMode: scope?.mode ?? "all",
  };
}

export function localHeuristicAnswer(
  message: string,
  context: AiContextBundle,
): string {
  const q = message.toLowerCase();
  const lines: string[] = [];
  lines.push("Платформын нэгтгэсэн өгөгдлөөс товч хариу (local горим).");
  lines.push(`Хандалт: ${context.scopeNote}`);
  lines.push("");

  if (/журам|нийцэл|policy|бүртгэгдсэн|заалт|агуулга/.test(q)) {
    lines.push("Журмын мэдээлэл:");
    const polKpis = context.kpis.filter((k) =>
      /журам|заалт|үнэлгээ/i.test(k.label),
    );
    for (const k of polKpis.slice(0, 8)) {
      lines.push(`• ${k.label}: ${k.value} — ${k.hint}`);
    }
    for (const h of context.highlights
      .filter((x) => /журам|заалт/i.test(x))
      .slice(0, 8)) {
      lines.push(`• ${h}`);
    }
  } else if (/эрсдэл|risk|өндөр/.test(q)) {
    const riskKpis = context.kpis.filter((k) =>
      /эрсдэл|өндөр|хэтэрсэн|хамрагдалт|сх төсөл|гомдол/i.test(k.label),
    );
    lines.push("Эрсдэлийн тойм:");
    for (const k of riskKpis.slice(0, 6)) {
      lines.push(`• ${k.label}: ${k.value} — ${k.hint}`);
    }
  } else if (/дуу|санал|гомдол|voice|telegram/.test(q)) {
    lines.push("Ажилтны дуу хоолойн тойм:");
    for (const h of context.highlights.filter((x) => /дуу|сэдэв/i.test(x)).slice(0, 6)) {
      lines.push(`• ${h}`);
    }
  } else if (/удирдамж|захиалга|дүгнэлт|guidance|гүйцэтгэл|прогресс/.test(q)) {
    lines.push("Удирдамжийн тойм:");
    const gKpis = context.kpis.filter((k) =>
      /удирдамж|прогресс|дууссан|блок|гүйцэтгэл/i.test(k.label),
    );
    for (const k of gKpis.slice(0, 8)) {
      lines.push(`• ${k.label}: ${k.value} — ${k.hint}`);
    }
    for (const h of context.highlights
      .filter((x) => /удирдамж|гүйцэтгэл|захиалга/i.test(x))
      .slice(0, 8)) {
      lines.push(`• ${h}`);
    }
  } else if (/шалгалт|зөрчил|хш|inspection|олдвор|дүгнэлт/.test(q)) {
    lines.push("Хяналт шалгалтын дохио:");
    for (const k of context.kpis.filter((x) => /шалгалт|олдвор|гүйлгээ|хш/i.test(x.label)).slice(0, 6)) {
      lines.push(`• ${k.label}: ${k.value} — ${k.hint}`);
    }
    for (const h of context.highlights
      .filter((x) => /хяналт|шалгалт|олдвор/i.test(x))
      .slice(0, 8)) {
      lines.push(`• ${h}`);
    }
  } else {
    lines.push("Платформын KPI:");
    for (const k of context.kpis.slice(0, 8)) {
      lines.push(`• ${k.label}: ${k.value} — ${k.hint}`);
    }
    for (const h of context.highlights
      .filter((x) => /Заалт |Олдвор:|Журам:/.test(x))
      .slice(0, 4)) {
      lines.push(`• ${h}`);
    }
  }

  if (lines.length < 5) {
    lines.push("Онцлох:");
    for (const h of context.highlights.slice(0, 6)) {
      lines.push(`• ${h}`);
    }
  }

  lines.push("");
  lines.push(
    "Зөвлөмж: өндөр эрсдэл, хугацаа хэтэрсэн ажлыг эхлээд хаа; модуль бүрийн эзэмшигчид томилгоо, нотлох баримт шаардана.",
  );
  if (Object.keys(context.sourceErrors).length > 0) {
    lines.push(
      `Анхаар: зарим эх систем холбогдоогүй (${Object.keys(context.sourceErrors).join(", ")}).`,
    );
  }
  return lines.join("\n");
}

export async function askOpenAi(params: {
  message: string;
  context: AiContextBundle;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return localHeuristicAnswer(params.message, params.context);
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const history = (params.history ?? []).slice(-8);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `Та INSPECT-MN платформын дотоод хяналтын AI туслах.
Зөвхөн өгсөн компани / платформын өгөгдөл дээр үндэслэн хариул.
Өгөгдөлд байхгүй тоо, үйл явдал, заалтын текст зохиохгүй.
Хэрэв контекстэд «Заалт …» эсвэл «Олдвор: …» хэсэг байвал түүнийг ашиглан товч тайлбарла.
Хандалтын хүрээг чанд баримтал: бусад алба/хэлтэсийн мэдээллийг таамаглах эсвэл нээхгүй.
Монгол хэлээр товч, удирдлагад ойлгомжтой хариул.
Шаардлагатай бол 3 хүртэл үйлдлийн зөвлөмж өг.
Модулиуд: Хяналт шалгалт, Журмын биелэлт, Судалгаа хөгжүүлэлт, Удирдамж, Ажилтны дуу хоолой, Эрсдэл, Тайлан, SmartMine.
Одоогийн хандалт: ${params.context.scopeNote}`,
        },
        {
          role: "user",
          content: `Платформын контекст:\n${params.context.summaryText}`,
        },
        ...history.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: params.message },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI алдаа (${res.status}): ${text.slice(0, 240)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  return (
    data.choices?.[0]?.message?.content?.trim() ||
    "AI хариу үүсгэж чадсангүй."
  );
}
