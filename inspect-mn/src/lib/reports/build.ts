import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { buildRiskOverview } from "@/lib/risk/overview";
import { overviewFromDb } from "@/lib/voice/overview";
import { readVoiceDb } from "@/lib/voice/store";
import { filterVoiceDbByUnit } from "@/lib/voice/unit-filter";
import type { UnitScope } from "@/lib/rbac/unit-scope";
import { matchesUnitText } from "@/lib/rbac/unit-scope";
import { ANALYSIS_TOOLS, type PlatformReport, type ReportKpi, type ReportRow, type TreeNode, type UnitScore } from "@/lib/reports/types";

function kpi(
  partial: Omit<ReportKpi, "value"> & { value: string | number },
): ReportKpi {
  return { ...partial, value: String(partial.value) };
}

export async function buildPlatformReport(
  unitScope?: UnitScope | null,
): Promise<PlatformReport> {
  const [risk, voiceDbRaw, people] = await Promise.all([
    buildRiskOverview(unitScope),
    readVoiceDb(),
    loadPeopleStats(unitScope),
  ]);
  const voiceDb = unitScope?.active
    ? filterVoiceDbByUnit(voiceDbRaw, unitScope)
    : voiceDbRaw;
  const voice = overviewFromDb(voiceDb);

  const insp = risk.bySource.find((s) => s.source === "inspection");
  const pol = risk.bySource.find((s) => s.source === "policy");
  const dev = risk.bySource.find((s) => s.source === "development");

  const kpis: ReportKpi[] = [
    kpi({
      id: "plat-systems",
      label: "Холбогдсон систем",
      value: Object.values(risk.sourcesOnline).filter(Boolean).length,
      hint: "ХШ · Журам · СХ · Дуу хоолой",
      tone: "neutral",
      level: "leadership",
      system: "Платформ",
      folder: ["Удирдлага", "Хамрах хүрээ"],
    }),
    kpi({
      id: "plat-users",
      label: "Идэвхтэй хэрэглэгч",
      value: people.activeUsers,
      hint: `${people.pendingAccess} нэвтрэх хүсэлт`,
      tone: people.pendingAccess > 0 ? "warn" : "good",
      level: "leadership",
      system: "Хандалт",
      folder: ["Удирдлага", "Хүний нөөц"],
    }),
    kpi({
      id: "dx-risk-active",
      label: "Идэвхтэй эрсдэл",
      value: risk.kpis.active,
      hint: `Үлдэгдэл ${risk.kpis.avgResidual}%`,
      tone: risk.kpis.active > 20 ? "warn" : "neutral",
      level: "dxshh",
      system: "Эрсдэл",
      folder: ["ДХШХ", "Эрсдэл"],
    }),
    kpi({
      id: "dx-risk-high",
      label: "Өндөр / ноцтой",
      value: risk.kpis.high,
      hint: "Нэн түрүүнд шийдэх",
      tone: risk.kpis.high > 0 ? "bad" : "good",
      level: "dxshh",
      system: "Эрсдэл",
      folder: ["ДХШХ", "Эрсдэл"],
    }),
    kpi({
      id: "dx-overdue",
      label: "Хугацаа хэтэрсэн",
      value: risk.kpis.overdue + voice.kpis.overdue,
      hint: "Эрсдэл + дуу хоолойн ажил",
      tone: risk.kpis.overdue + voice.kpis.overdue > 0 ? "bad" : "good",
      level: "dxshh",
      system: "Гүйцэтгэл",
      folder: ["ДХШХ", "Гүйцэтгэл"],
    }),
    kpi({
      id: "dx-coverage",
      label: "Засварын хамрагдалт",
      value: `${risk.kpis.coveragePercent}%`,
      hint: "Төлөвлөгөөтэй эрсдэл",
      tone: risk.kpis.coveragePercent >= 60 ? "good" : "warn",
      level: "dxshh",
      system: "Гүйцэтгэл",
      folder: ["ДХШХ", "Гүйцэтгэл"],
    }),
    kpi({
      id: "mod-insp",
      label: "ХШ дохио",
      value: insp?.count ?? 0,
      hint: `Өндөр ${insp?.highCount ?? 0}`,
      tone: (insp?.highCount ?? 0) > 0 ? "warn" : "neutral",
      level: "module",
      system: "Хяналт шалгалт",
      folder: ["Үүрэг", "Хяналт шалгалт"],
    }),
    kpi({
      id: "mod-pol",
      label: "Журмын цоорхой",
      value: pol?.count ?? 0,
      hint: `Өндөр ${pol?.highCount ?? 0}`,
      tone: (pol?.count ?? 0) > 10 ? "warn" : "neutral",
      level: "module",
      system: "Журмын биелэлт",
      folder: ["Үүрэг", "Журмын биелэлт"],
    }),
    kpi({
      id: "mod-dev",
      label: "СХ төслийн эрсдэл",
      value: dev?.count ?? 0,
      hint: `Явж буй ${dev?.inProgressCount ?? 0}`,
      tone: "neutral",
      level: "module",
      system: "Судалгаа хөгжүүлэлт",
      folder: ["Үүрэг", "Судалгаа хөгжүүлэлт"],
    }),
    kpi({
      id: "mod-voice",
      label: "Дуу хоолой нээлттэй",
      value: voice.kpis.open,
      hint: `Telegram ${voice.kpis.telegram}`,
      tone: voice.kpis.open > 5 ? "warn" : "neutral",
      level: "module",
      system: "Ажилтны дуу хоолой",
      folder: ["Үр дүн", "Ажилтны дуу хоолой"],
    }),
    kpi({
      id: "mod-voice-high",
      label: "Өндөр гомдол/санал",
      value: voice.kpis.high,
      hint: "Priority high/critical",
      tone: voice.kpis.high > 0 ? "bad" : "good",
      level: "module",
      system: "Ажилтны дуу хоолой",
      folder: ["Үр дүн", "Ажилтны дуу хоолой"],
    }),
    kpi({
      id: "mod-voice-act",
      label: "Хариу ажил нээлттэй",
      value: voice.kpis.actionsOpen,
      hint: `Мэдэгдэл ${voice.kpis.notices}`,
      tone: "neutral",
      level: "dxshh",
      system: "Ажилтны дуу хоолой",
      folder: ["ДХШХ", "Хариу арга хэмжээ"],
    }),
    kpi({
      id: "dx-inprogress",
      label: "Засвар явж буй",
      value: risk.kpis.inProgress,
      hint: "Эрсдэлийн ажлын явц",
      tone: "neutral",
      level: "dxshh",
      system: "Эрсдэл",
      folder: ["ДХШХ", "Эрсдэл"],
    }),
    kpi({
      id: "lead-residual",
      label: "Үлдэгдэл эрсдэл",
      value: `${risk.kpis.avgResidual}%`,
      hint: "Платформын дундаж",
      tone: risk.kpis.avgResidual >= 60 ? "bad" : "warn",
      level: "leadership",
      system: "Эрсдэл",
      folder: ["Удирдлага", "Эрсдэл"],
    }),
    kpi({
      id: "lead-roles",
      label: "Role бүхий профайл",
      value: people.withRole,
      hint: `${people.adminCount} админ`,
      tone: "neutral",
      level: "leadership",
      system: "Хандалт",
      folder: ["Удирдлага", "Хүний нөөц"],
    }),
  ];

  const units = buildUnits(risk.items, voiceDb.items);
  for (const u of units.slice(0, 8)) {
    kpis.push(
      kpi({
        id: `unit-${u.unit}`,
        label: u.unit,
        value: u.signals,
        hint: `Өндөр ${u.high} · үлдэгдэл ${u.residual}%`,
        tone: u.high > 0 ? "warn" : "neutral",
        level: "unit",
        system: "Нэгж",
        folder: ["Нэгж", u.unit],
      }),
    );
  }

  const rows: ReportRow[] = risk.items.slice(0, 80).map((item) => ({
    id: item.id,
    system: item.sourceLabel,
    title: item.title,
    metric: `${item.score}%`,
    value: item.severity,
    status: item.status,
    owner: item.owner,
    unit: item.unit,
    level: "dxshh",
    date: item.updatedAt.slice(0, 10),
    href: item.href,
  }));

  const tree = buildTree({ risk, voice, people, units });
  const conclusions = [
    ...risk.conclusion.slice(0, 3),
    ...voice.conclusions.slice(0, 2),
    people.pendingAccess
      ? `Нэвтрэх хүсэлт ${people.pendingAccess} хүлээгдэж байна.`
      : "Нэвтрэх хүсэлтийн дараалал хоосон.",
  ];

  return {
    generatedAt: new Date().toISOString(),
    title: "ДХШХ-ийн үйл ажиллагааны нэгдсэн удирдлага",
    kpis,
    rows,
    tree,
    tools: ANALYSIS_TOOLS,
    units,
    conclusions,
    bySystem: risk.bySource.map((s) => ({
      system: s.label,
      count: s.count,
      high: s.highCount,
    })),
    matrix: risk.matrix,
    voiceThemes: voice.themes,
    sourceErrors: Object.fromEntries(
      Object.entries(risk.sourceErrors).filter(([, v]) => Boolean(v)),
    ) as Record<string, string>,
  };
}

function buildUnits(
  risks: { unit: string; severity: string; status: string; score: number }[],
  voices: { department: string; priority: string }[],
): UnitScore[] {
  const map = new Map<string, UnitScore>();
  function row(unit: string) {
    const key = unit.trim() || "Тодорхойгүй";
    const current = map.get(key) ?? {
      unit: key,
      signals: 0,
      high: 0,
      overdue: 0,
      voice: 0,
      residual: 0,
    };
    map.set(key, current);
    return current;
  }
  const scoreSum = new Map<string, { n: number; s: number }>();
  for (const r of risks) {
    const u = row(r.unit);
    u.signals += 1;
    if (r.severity === "high" || r.severity === "critical") u.high += 1;
    if (r.status === "overdue") u.overdue += 1;
    const acc = scoreSum.get(u.unit) ?? { n: 0, s: 0 };
    acc.n += 1;
    acc.s += r.score;
    scoreSum.set(u.unit, acc);
  }
  for (const v of voices) {
    const u = row(v.department);
    u.voice += 1;
    if (v.priority === "high" || v.priority === "critical") u.high += 1;
  }
  for (const u of map.values()) {
    const acc = scoreSum.get(u.unit);
    u.residual = acc && acc.n ? Math.round(acc.s / acc.n) : 0;
  }
  return [...map.values()].sort((a, b) => b.signals + b.voice - (a.signals + a.voice));
}

function node(
  id: string,
  label: string,
  children: TreeNode[],
  extra?: Partial<TreeNode>,
): TreeNode {
  const count = children.reduce((s, c) => s + (c.count ?? 0), 0);
  return { id, label, kind: "folder", count, children, ...extra };
}

function leaf(id: string, label: string, href: string, count: number): TreeNode {
  return { id, label, kind: "report", href, count };
}

function buildTree(input: {
  risk: Awaited<ReturnType<typeof buildRiskOverview>>;
  voice: ReturnType<typeof overviewFromDb>;
  people: { activeUsers: number; pendingAccess: number };
  units: UnitScore[];
}): TreeNode[] {
  const r = input.risk;
  const v = input.voice;
  const insp = r.bySource.find((s) => s.source === "inspection")?.count ?? 0;
  const pol = r.bySource.find((s) => s.source === "policy")?.count ?? 0;
  const dev = r.bySource.find((s) => s.source === "development")?.count ?? 0;
  const voi = r.bySource.find((s) => s.source === "voice")?.count ?? 0;

  return [
    node("dxshh", "ДХШХ нэгдсэн удирдлага", [
      node("duty", "Үүргийн системүүд", [
        node("insp", "Хяналт шалгалт", [
          leaf("insp-signals", "Эрсдэлийн дохио", "/risk-management/sources?source=inspection", insp),
          leaf("insp-mod", "ХШ модуль", "/inspection", insp),
        ]),
        node("pol", "Журмын биелэлт", [
          leaf("pol-gap", "Хангалтгүй үнэлгээ", "/risk-management/sources?source=policy", pol),
          leaf("pol-mod", "Журмын модуль", "/policy-compliance", pol),
        ]),
        node("dev", "Судалгаа хөгжүүлэлт", [
          leaf("dev-risk", "Төслийн эрсдэл", "/development", dev),
        ]),
      ]),
      node("result", "Үр дүн", [
        node("voice", "Ажилтны дуу хоолой", [
          leaf("voice-open", "Нээлттэй бүртгэл", "/employee-voice/inbox", v.kpis.open),
          leaf("voice-act", "Хариу арга хэмжээ", "/employee-voice/actions", v.kpis.actionsOpen),
          leaf("voice-tg", "Telegram", "/employee-voice/telegram", v.kpis.telegram),
        ]),
        node("risk", "Эрсдэлийн удирдлага", [
          leaf("risk-high", "Өндөр зэрэглэл", "/risk-management/register?filter=high", r.kpis.high),
          leaf("risk-over", "Хэтэрсэн", "/risk-management/work?status=overdue", r.kpis.overdue),
          leaf("risk-voice", "Дуу хоолойноос", "/employee-voice/notify", voi),
        ]),
      ]),
      node("kpi", "KPI сан", [
        leaf("kpi-lead", "Удирдлагын түвшин", "/report-analysis/kpis?level=leadership", 3),
        leaf("kpi-dx", "ДХШХ түвшин", "/report-analysis/kpis?level=dxshh", 5),
        leaf("kpi-unit", "Нэгжийн түвшин", "/report-analysis/kpis?level=unit", input.units.length),
        leaf("kpi-mod", "Модулийн түвшин", "/report-analysis/kpis?level=module", 5),
      ]),
      node("tools", "Багаж, хэрэгсэл", [
        leaf("tool-an", "Шинжилгээ", "/report-analysis/analysis", ANALYSIS_TOOLS.length),
        leaf("tool-ex", "Excel / PDF", "/report-analysis/exports", 2),
        leaf("tool-ops", "Түвшингийн самбар", "/report-analysis/operations", 4),
      ]),
      node(
        "units",
        "Нэгжүүд",
        input.units.slice(0, 12).map((u) =>
          leaf(`u-${u.unit}`, u.unit, "/report-analysis/operations?level=unit", u.signals + u.voice),
        ),
      ),
      node("access", "Хандалт", [
        leaf("acc-users", "Идэвхтэй хэрэглэгч", "/settings/users", input.people.activeUsers),
        leaf("acc-req", "Нэвтрэх хүсэлт", "/settings/access-requests", input.people.pendingAccess),
      ]),
    ]),
  ];
}

async function loadPeopleStats(unitScope?: UnitScope | null) {
  if (!hasServiceRole()) {
    return { activeUsers: 0, withRole: 0, adminCount: 0, pendingAccess: 0 };
  }
  const admin = createAdminClient();
  const [{ data: profiles }, { count: pending }] = await Promise.all([
    admin
      .from("user_profiles")
      .select("status, role_id, heltes_id, alba_id, heltes_name, alba_name"),
    admin
      .from("access_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);
  let rows = profiles ?? [];
  if (unitScope?.active) {
    rows = rows.filter((p) => {
      if (unitScope.albaId && p.alba_id === unitScope.albaId) return true;
      if (unitScope.heltesId && p.heltes_id === unitScope.heltesId) return true;
      const label = `${p.alba_name ?? ""} ${p.heltes_name ?? ""}`;
      return matchesUnitText(label, unitScope);
    });
  }
  return {
    activeUsers: rows.filter((p) => p.status === "active").length,
    withRole: rows.filter((p) => p.role_id).length,
    adminCount: rows.filter((p) => p.role_id === "admin").length,
    pendingAccess: unitScope?.active ? 0 : (pending ?? 0),
  };
}
