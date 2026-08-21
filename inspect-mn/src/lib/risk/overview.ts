import { getDutyModuleApps } from "@/lib/module-apps";
import { shouldNotifyRisk } from "@/lib/voice/classify";
import { isClosed } from "@/lib/voice/overview";
import { readVoiceDb } from "@/lib/voice/store";
import { inspectionSignalsFromStore } from "@/lib/risk/inspection-signals";
import { policySignalsFromStore } from "@/lib/risk/policy-signals";
import type { UnitScope } from "@/lib/rbac/unit-scope";
import { matchesUnitText } from "@/lib/rbac/unit-scope";
import type {
  RiskMatrixCell,
  RiskOverview,
  RiskSignal,
  RiskSource,
  RiskSourceSummary,
} from "@/lib/risk/types";

const SOURCE_LABEL: Record<RiskSource, string> = {
  inspection: "Хяналт шалгалт",
  policy: "Журмын биелэлт",
  development: "Судалгаа хөгжүүлэлт",
  voice: "Ажилтны дуу хоолой",
};

async function voiceSignals(): Promise<{ items: RiskSignal[]; error?: string }> {
  try {
    const db = await readVoiceDb();
    const items: RiskSignal[] = db.items
      .filter((item) => !isClosed(item.status) && shouldNotifyRisk(item))
      .map((item) => {
        const severity =
          item.priority === "critical"
            ? "critical"
            : item.priority === "high"
              ? "high"
              : item.priority === "low"
                ? "low"
                : "medium";
        const impact =
          severity === "critical"
            ? 5
            : severity === "high"
              ? 4
              : severity === "medium"
                ? 3
                : 2;
        const score =
          severity === "critical"
            ? 88
            : severity === "high"
              ? 70
              : severity === "medium"
                ? 48
                : 28;
        const action = db.actions.find((a) => a.voiceId === item.id);
        return {
          id: `voice-${item.id}`,
          source: "voice" as const,
          sourceLabel: "Ажилтны дуу хоолой",
          title: item.title,
          description: item.description,
          unit: item.department || "—",
          owner: item.assignedTo || item.submittedBy || "—",
          severity,
          score,
          status:
            action?.kind === "in_progress"
              ? "in_progress"
              : action?.kind === "done"
                ? "mitigated"
                : "open",
          likelihood: impact,
          impact,
          mitigation: {
            summary:
              item.predictedAction ||
              item.actionTaken ||
              "Хариу арга хэмжээ төлөвлөх",
            progressPercent: action?.progressPercent ?? 0,
            dueDate: action?.dueDate ?? item.dueDate,
            workStatus: item.predictedAction || "Шинэ",
          },
          href: "/employee-voice",
          updatedAt: item.updatedAt,
        };
      });
    return { items };
  } catch (err) {
    return {
      items: [],
      error: err instanceof Error ? err.message : "Дуу хоолой уншигдсангүй",
    };
  }
}

async function fetchSignals(
  origin: string,
): Promise<{ items: RiskSignal[]; error?: string }> {
  try {
    const res = await fetch(`${origin}/api/risk/signals`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) {
      return { items: [], error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as {
      ok?: boolean;
      items?: RiskSignal[];
      error?: string;
    };
    if (!data.ok) {
      return { items: [], error: data.error || "Алдаа" };
    }
    return { items: Array.isArray(data.items) ? data.items : [] };
  } catch (err) {
    return {
      items: [],
      error: err instanceof Error ? err.message : "Холбогдож чадсангүй",
    };
  }
}

async function withStoreFallback(
  source: "inspection" | "policy",
  origin: string,
): Promise<{ items: RiskSignal[]; error?: string }> {
  const remote = await fetchSignals(origin);
  if (!remote.error) return remote;

  const local =
    source === "inspection"
      ? await inspectionSignalsFromStore()
      : await policySignalsFromStore();

  if (local.items.length > 0) {
    return { items: local.items };
  }

  return {
    items: [],
    error:
      [remote.error, local.error].filter(Boolean).join(" · ") || remote.error,
  };
}

function summarize(source: RiskSource, items: RiskSignal[]): RiskSourceSummary {
  const highCount = items.filter(
    (i) => i.severity === "high" || i.severity === "critical",
  ).length;
  const overdueCount = items.filter((i) => i.status === "overdue").length;
  const inProgressCount = items.filter((i) => i.status === "in_progress").length;
  const avgScore =
    items.length === 0
      ? 0
      : Math.round(items.reduce((s, i) => s + i.score, 0) / items.length);
  return {
    source,
    label: SOURCE_LABEL[source],
    count: items.length,
    highCount,
    overdueCount,
    avgScore,
    inProgressCount,
  };
}

function buildMatrix(items: RiskSignal[]): RiskMatrixCell[] {
  const cells: RiskMatrixCell[] = [];
  for (let impact = 5; impact >= 1; impact--) {
    for (let likelihood = 1; likelihood <= 5; likelihood++) {
      cells.push({
        likelihood,
        impact,
        count: items.filter(
          (i) =>
            Math.min(5, Math.max(1, i.likelihood)) === likelihood &&
            Math.min(5, Math.max(1, i.impact)) === impact,
        ).length,
      });
    }
  }
  return cells;
}

function withPortalHref(item: RiskSignal): RiskSignal {
  const prefix =
    item.source === "inspection"
      ? "/inspection"
      : item.source === "policy"
        ? "/policy-compliance"
        : item.source === "voice"
          ? "/employee-voice"
          : "/development";
  return { ...item, href: prefix };
}

function conclusions(bySource: RiskSourceSummary[], items: RiskSignal[]) {
  const lines: string[] = [];
  const total = items.length;
  const high = items.filter(
    (i) => i.severity === "high" || i.severity === "critical",
  ).length;
  const overdue = items.filter((i) => i.status === "overdue").length;
  const inProgress = items.filter((i) => i.status === "in_progress").length;
  const avg =
    total === 0 ? 0 : Math.round(items.reduce((s, i) => s + i.score, 0) / total);

  if (total === 0) {
    return [
      "Модулиудаас идэвхтэй эрсдэлийн дохио илрээгүй, эсвэл эх системүүд хариу өгөөгүй байна.",
      "Шалгалтын зөрчил, журмын хангалтгүй үнэлгээ, СХ төслийн зогсолтыг дахин шалгана уу.",
    ];
  }

  lines.push(
    `Нийт ${total} эрсдэлийн дохио бүртгэгдсэн. Үлдэгдэл эрсдэлийн дундаж ${avg}%.`,
  );
  lines.push(
    high > 0
      ? `${high} нь өндөр/маш их зэрэглэлтэй тул нэн түрүүнд хариуцагч, хугацаа, нотлох баримт шаардана.`
      : "Өндөр зэрэглэлийн эрсдэл одоогоор бүртгэгдээгүй.",
  );
  if (overdue > 0) {
    lines.push(
      `Засвар арга хэмжээний ${overdue} нь хугацаа хэтэрсэн — гүйцэтгэлийг яаралтай хянана уу.`,
    );
  }
  lines.push(
    inProgress > 0
      ? `${inProgress} эрсдэл дээр засвар ажил хийгдэж байна. Явцыг доорх жагсаалтаар хянана.`
      : "Идэвхтэй засвар төлөвлөгөө цөөн байна — төлөвлөгөөгүй зүйлд хариуцагч томилно уу.",
  );

  const top = [...bySource].sort((a, b) => b.count - a.count)[0];
  if (top && top.count > 0) {
    lines.push(
      `Гол эх үүсвэр: ${top.label} (${top.count} дохио, өндөр ${top.highCount}).`,
    );
  }
  return lines;
}

export async function buildRiskOverview(
  unitScope?: UnitScope | null,
): Promise<RiskOverview> {
  const apps = getDutyModuleApps();
  const [inspection, policy, development, voice] = await Promise.all([
    withStoreFallback("inspection", apps.inspection.origin),
    withStoreFallback("policy", apps["policy-compliance"].origin),
    fetchSignals(apps.development.origin),
    voiceSignals(),
  ]);

  const scope = unitScope?.active ? unitScope : null;
  const keep = (item: RiskSignal) =>
    !scope || matchesUnitText(item.unit, scope);

  const inspectionItems = inspection.items.filter(keep).map(withPortalHref);
  const policyItems = policy.items.filter(keep).map(withPortalHref);
  const developmentItems = development.items.filter(keep).map(withPortalHref);
  const voiceItems = voice.items.filter(keep).map(withPortalHref);

  const items = [
    ...inspectionItems,
    ...policyItems,
    ...developmentItems,
    ...voiceItems,
  ].sort((a, b) => b.score - a.score || b.updatedAt.localeCompare(a.updatedAt));

  const bySource = [
    summarize("inspection", inspectionItems),
    summarize("policy", policyItems),
    summarize("development", developmentItems),
    summarize("voice", voiceItems),
  ];

  const high = items.filter(
    (i) => i.severity === "high" || i.severity === "critical",
  ).length;
  const inProgress = items.filter((i) => i.status === "in_progress").length;
  const overdue = items.filter((i) => i.status === "overdue").length;
  const avgResidual =
    items.length === 0
      ? 0
      : Math.round(items.reduce((s, i) => s + i.score, 0) / items.length);
  const withWork = items.filter(
    (i) => i.status === "in_progress" || i.mitigation.progressPercent > 0,
  ).length;

  const sourceErrors: RiskOverview["sourceErrors"] = {};
  if (inspection.error) sourceErrors.inspection = inspection.error;
  if (policy.error) sourceErrors.policy = policy.error;
  if (development.error) sourceErrors.development = development.error;
  if (voice.error) sourceErrors.voice = voice.error;

  return {
    generatedAt: new Date().toISOString(),
    sourcesOnline: {
      inspection: !inspection.error,
      policy: !policy.error,
      development: !development.error,
      voice: !voice.error,
    },
    sourceErrors,
    kpis: {
      active: items.length,
      high,
      inProgress,
      overdue,
      avgResidual,
      coveragePercent:
        items.length === 0 ? 0 : Math.round((withWork / items.length) * 100),
    },
    bySource,
    matrix: buildMatrix(items),
    conclusion: conclusions(bySource, items),
    items,
  };
}
