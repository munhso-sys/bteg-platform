import { eachDay, type DateRange } from "./range";
import { isoDay, num } from "./numbers";
import type {
  DualAxisPoint,
  EquipmentRow,
  ProcessingDailyRow,
  ProcessingEquipmentSummary,
  ProcessingPlantRow,
  ProcessingSummary,
  ProcessingTrendPoint,
  ReasonCandidate,
  SectorRow,
  SyncStatus,
} from "./types";

export const PROCESSING_EQUIPMENT_CATEGORIES: ProcessingEquipmentSummary["category"][] =
  ["Dump", "Exca", "Loader", "Bulldozer"];

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildProcessingStats(rows: Array<Record<string, unknown>>) {
  const days = new Set<string>();
  const plants = new Map<
    string,
    { oreFeed: number; concentrate: number; recoveries: number[]; days: Set<string> }
  >();
  const dailyMap = new Map<
    string,
    { plantName: string; oreFeed: number; concentrate: number; recoveries: number[] }
  >();

  let oreFeedTons = 0;
  let concentrateTons = 0;
  const recoveries: number[] = [];

  for (const row of rows) {
    const date = isoDay(row.production_date);
    if (!date) continue;
    days.add(date);
    const plantName = String(row.plant_name ?? "Plant");
    const feed = num(row.ore_feed_tons);
    const concentrate = num(row.concentrate_tons);
    const recovery = num(row.recovery_percent);

    oreFeedTons += feed;
    concentrateTons += concentrate;
    if (recovery > 0) recoveries.push(recovery);

    const plant = plants.get(plantName) ?? {
      oreFeed: 0,
      concentrate: 0,
      recoveries: [],
      days: new Set<string>(),
    };
    plant.oreFeed += feed;
    plant.concentrate += concentrate;
    plant.days.add(date);
    if (recovery > 0) plant.recoveries.push(recovery);
    plants.set(plantName, plant);

    const key = `${date}|${plantName}`;
    const daily = dailyMap.get(key) ?? {
      plantName,
      oreFeed: 0,
      concentrate: 0,
      recoveries: [],
    };
    daily.oreFeed += feed;
    daily.concentrate += concentrate;
    if (recovery > 0) daily.recoveries.push(recovery);
    dailyMap.set(key, daily);
  }

  const plantRows: ProcessingPlantRow[] = [...plants.entries()]
    .map(([plantName, value]) => ({
      plantName,
      oreFeedTons: Number(value.oreFeed.toFixed(1)),
      concentrateTons: Number(value.concentrate.toFixed(1)),
      recoveryPercent: Number(avg(value.recoveries).toFixed(1)),
      processingDays: value.days.size,
    }))
    .sort((a, b) => b.oreFeedTons - a.oreFeedTons);

  const daily: ProcessingDailyRow[] = [...dailyMap.entries()]
    .map(([key, value]) => ({
      date: key.split("|")[0],
      plantName: value.plantName,
      oreFeedTons: Number(value.oreFeed.toFixed(1)),
      concentrateTons: Number(value.concentrate.toFixed(1)),
      recoveryPercent: Number(avg(value.recoveries).toFixed(1)),
    }))
    .sort((a, b) => b.date.localeCompare(a.date) || a.plantName.localeCompare(b.plantName));

  return {
    oreFeedTons: Number(oreFeedTons.toFixed(1)),
    concentrateTons: Number(concentrateTons.toFixed(1)),
    recoveryPercent: Number(avg(recoveries).toFixed(1)),
    processingDays: days.size,
    plants: plantRows,
    daily,
  };
}

export function buildProcessingTrend(
  rows: Array<Record<string, unknown>>,
  range: DateRange,
): ProcessingTrendPoint[] {
  const byDay = new Map<string, { oreFeed: number; concentrate: number }>();
  const start = range.from.slice(0, 10);
  const end = range.to.slice(0, 10);

  for (const row of rows) {
    const date = isoDay(row.production_date);
    if (!date || date < start || date > end) continue;
    const entry = byDay.get(date) ?? { oreFeed: 0, concentrate: 0 };
    entry.oreFeed += num(row.ore_feed_tons);
    entry.concentrate += num(row.concentrate_tons);
    byDay.set(date, entry);
  }

  return [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({
      date,
      oreFeedTonnes: Number(value.oreFeed.toFixed(1)),
      concentrateTonnes: Number(value.concentrate.toFixed(1)),
    }));
}

export function buildProcessingSummary(
  processing: ReturnType<typeof buildProcessingStats>,
  equipmentRows: Array<Record<string, unknown>>,
  equipmentSourceError: string | null = null,
): ProcessingSummary {
  const aggregates = new Map<
    ProcessingEquipmentSummary["category"],
    { count: number; operatedHours: number }
  >();

  for (const row of equipmentRows) {
    const category = normalizeEquipmentCategory(row.equipment_category);
    if (!category) continue;
    const current = aggregates.get(category) ?? { count: 0, operatedHours: 0 };
    current.count = Math.max(current.count, num(row.equipment_count));
    current.operatedHours += num(row.operated_hours);
    aggregates.set(category, current);
  }

  const equipment: ProcessingEquipmentSummary[] =
    PROCESSING_EQUIPMENT_CATEGORIES.map((category) => {
      const value = aggregates.get(category);
      return {
        category,
        count: value ? value.count : null,
        operatedHours: value ? Number(value.operatedHours.toFixed(2)) : null,
      };
    });
  const totalOperatedHours = [...aggregates.values()].reduce(
    (sum, value) => sum + value.operatedHours,
    0,
  );
  const activeEquipmentCount = [...aggregates.values()].reduce(
    (sum, value) => sum + value.count,
    0,
  );

  return {
    equipment,
    equipmentAvailable: aggregates.size > 0,
    missingEquipmentSource: equipmentSourceError,
    plants: processing.plants.map((plant) => ({
      name: plant.plantName,
      oreFeedTonnes: plant.oreFeedTons,
      concentrateTonnes: plant.concentrateTons,
      recoveryPct: plant.recoveryPercent,
      activeDays: plant.processingDays,
    })),
    totalOperatedHours:
      aggregates.size > 0 ? Number(totalOperatedHours.toFixed(2)) : null,
    avgOperatedHoursPerActive:
      activeEquipmentCount > 0
        ? Number((totalOperatedHours / activeEquipmentCount).toFixed(2))
        : null,
  };
}

function normalizeEquipmentCategory(
  value: unknown,
): ProcessingEquipmentSummary["category"] | null {
  const category = String(value ?? "")
    .trim()
    .toLowerCase();
  if (/dump|truck|самосвал/.test(category)) return "Dump";
  if (/exca|excavator|экскаватор/.test(category)) return "Exca";
  if (/loader|ачигч/.test(category)) return "Loader";
  if (/bulldozer|dozer|бульдозер/.test(category)) return "Bulldozer";
  return null;
}

export function buildMaintenanceStats(
  rows: Array<Record<string, unknown>>,
  range: DateRange,
) {
  const machines = new Map<
    string,
    {
      machineName: string;
      sectorName: string;
      workOrders: number;
      openWorkOrders: number;
      downtimeHours: number;
      mttrValues: number[];
      lastDay: string | null;
    }
  >();
  const sectors = new Map<string, { workOrders: number; downtimeHours: number }>();
  const byDay = new Map<
    string,
    { downtime: number; workOrders: number; mttr: number[]; }
  >();

  let workOrders = 0;
  let downtimeHours = 0;
  const mttrValues: number[] = [];

  for (const row of rows) {
    const date = isoDay(row.day_date);
    if (!date) continue;
    const machineId = String(row.machine_id ?? row.machine_name ?? "unknown");
    const machineName = String(row.machine_name ?? row.machine_id ?? "Unknown");
    const sectorName = String(row.sector_name ?? row.sector_id ?? "Unknown");
    const wo = num(row.work_order_count);
    const dt = num(row.total_downtime_hours);
    const mttr = num(row.mttr_hours);
    const open = num(row.open_work_order_count);

    workOrders += wo;
    downtimeHours += dt;
    if (mttr > 0) mttrValues.push(mttr);

    const machine = machines.get(machineId) ?? {
      machineName,
      sectorName,
      workOrders: 0,
      openWorkOrders: 0,
      downtimeHours: 0,
      mttrValues: [],
      lastDay: null as string | null,
    };
    machine.workOrders += wo;
    machine.openWorkOrders += open;
    machine.downtimeHours += dt;
    if (mttr > 0) machine.mttrValues.push(mttr);
    if (!machine.lastDay || date > machine.lastDay) machine.lastDay = date;
    machines.set(machineId, machine);

    const sector = sectors.get(sectorName) ?? { workOrders: 0, downtimeHours: 0 };
    sector.workOrders += wo;
    sector.downtimeHours += dt;
    sectors.set(sectorName, sector);

    const day = byDay.get(date) ?? { downtime: 0, workOrders: 0, mttr: [] };
    day.downtime += dt;
    day.workOrders += wo;
    if (mttr > 0) day.mttr.push(mttr);
    byDay.set(date, day);
  }

  const equipment: EquipmentRow[] = [...machines.entries()]
    .map(([machineId, value]) => ({
      machineId,
      machineName: value.machineName,
      sectorName: value.sectorName,
      workOrders: value.workOrders,
      openWorkOrders: value.openWorkOrders,
      downtimeHours: Number(value.downtimeHours.toFixed(2)),
      mttrHours: Number(avg(value.mttrValues).toFixed(2)),
      lastDay: value.lastDay,
    }))
    .sort((a, b) => b.downtimeHours - a.downtimeHours);

  const bySector: SectorRow[] = [...sectors.entries()]
    .map(([sectorName, value]) => ({
      sectorName,
      workOrders: value.workOrders,
      downtimeHours: Number(value.downtimeHours.toFixed(2)),
    }))
    .sort((a, b) => b.downtimeHours - a.downtimeHours);

  const series: DualAxisPoint[] = eachDay(range.from, range.to).map((date) => {
    const day = byDay.get(date);
    return {
      date,
      mttrHours: Number(avg(day?.mttr ?? []).toFixed(2)),
      downtimeHours: Number((day?.downtime ?? 0).toFixed(2)),
      workOrders: day?.workOrders ?? 0,
    };
  });

  return {
    workOrders,
    downtimeHours: Number(downtimeHours.toFixed(2)),
    mttrHours: Number(avg(mttrValues).toFixed(2)),
    topEquipment: equipment[0]?.machineName ?? "—",
    bySector,
    equipment,
    series,
  };
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function candidateText(value: unknown): {
  title: string;
  detail: string;
  date: string | null;
} {
  if (typeof value === "string") {
    return { title: value, detail: "", date: null };
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const row = value as Record<string, unknown>;
    const title = String(
      row.kpi_name ??
        row.title ??
        row.event ??
        row.name ??
        row.reason ??
        row.candidate ??
        "Root-cause candidate",
    );
    const cause = String(row.root_cause ?? row.detail ?? row.description ?? "");
    const rec = String(row.recommendation ?? "");
    return {
      title,
      detail: [cause, rec].filter(Boolean).join(" "),
      date: isoDay(row.event_date ?? row.date ?? row.day ?? row.created_at),
    };
  }
  return { title: "Root-cause candidate", detail: "", date: null };
}

export function extractRootCauseCandidates(
  syncRows: Array<Record<string, unknown>>,
): ReasonCandidate[] {
  const out: ReasonCandidate[] = [];
  for (const [index, row] of syncRows.entries()) {
    const meta = asObject(row.metadata);
    if (!meta) continue;
    const raw =
      meta.root_cause_candidates ??
      meta.rootCauseCandidates ??
      meta.root_causes;
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const started = isoDay(row.started_at ?? row.created_at ?? row.completed_at);
    for (const [i, item] of list.entries()) {
      const text = candidateText(item);
      const itemObj =
        item && typeof item === "object" && !Array.isArray(item)
          ? (item as Record<string, unknown>)
          : null;
      const severityRaw = String(itemObj?.severity ?? "").toLowerCase();
      const blob = `${text.title} ${text.detail} ${itemObj?.kpi_code ?? ""}`;
      out.push({
        id: `sync-${index}-${i}`,
        title: text.title,
        detail: text.detail,
        severity:
          severityRaw === "critical"
            ? "critical"
            : severityRaw === "high"
              ? "high"
              : "medium",
        source: "public.data_sync_jobs.metadata.root_cause_candidates",
        date: text.date ?? started,
        metric: /mttr/i.test(blob)
          ? "mttr"
          : /down/i.test(blob)
            ? "downtime"
            : "sync",
      });
    }
  }
  return out.sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
}

export function fallbackReasonCandidates(
  series: DualAxisPoint[],
  topEquipment: string,
  recoveryPercent: number,
): ReasonCandidate[] {
  const reasons: ReasonCandidate[] = [];
  if (series.length < 4) return reasons;

  const mid = Math.floor(series.length / 2);
  const first = series.slice(0, mid);
  const second = series.slice(mid);
  const firstMttr = avg(first.map((p) => p.mttrHours).filter((v) => v > 0));
  const secondMttr = avg(second.map((p) => p.mttrHours).filter((v) => v > 0));
  const firstDt = avg(first.map((p) => p.downtimeHours));
  const secondDt = avg(second.map((p) => p.downtimeHours));

  if (firstMttr > 0 && secondMttr > firstMttr * 1.15) {
    reasons.push({
      id: "fallback-mttr",
      title: "MTTR өсөлт",
      detail: `Сонгосон интервалын хоёрдугаар хагаст дундаж MTTR ${firstMttr.toFixed(2)} → ${secondMttr.toFixed(2)} цаг болж өссөн. ${topEquipment !== "—" ? `Анхаарах төхөөрөмж: ${topEquipment}.` : ""}`,
      severity: "high",
      source: "derived from v_maintenance_work_order_dashboard",
      date: second.at(-1)?.date ?? null,
      metric: "mttr",
    });
  }

  if (secondDt > firstDt * 1.15 && secondDt > 0) {
    reasons.push({
      id: "fallback-downtime",
      title: "Downtime өсөлт",
      detail: `Downtime ${firstDt.toFixed(1)} → ${secondDt.toFixed(1)} цаг/өдөр болж нэмэгдсэн. Давтагдсан эвдрэл эсвэл сэлбэгийн хүлээлт байж болно.`,
      severity: secondDt > firstDt * 1.4 ? "high" : "medium",
      source: "derived from v_maintenance_work_order_dashboard",
      date: second.at(-1)?.date ?? null,
      metric: "downtime",
    });
  }

  if (recoveryPercent > 0 && recoveryPercent < 85) {
    reasons.push({
      id: "fallback-recovery",
      title: "Recovery зорилтоос доогуур",
      detail: `Боловсруулалтын recovery ${recoveryPercent}% байна. Grind-float баланс, ore feed чанарыг шалгана уу.`,
      severity: "high",
      source: "derived from v_processing_dashboard",
      date: null,
      metric: "processing",
    });
  }

  return reasons;
}

export function buildSyncStatus(rows: Array<Record<string, unknown>>): SyncStatus {
  const latest = [...rows].sort((a, b) =>
    String(b.started_at ?? b.created_at ?? "").localeCompare(
      String(a.started_at ?? a.created_at ?? ""),
    ),
  )[0];
  const latestStatus = latest
    ? String(latest.status ?? latest.job_status ?? "unknown")
    : null;
  const ok = latestStatus
    ? !/fail|error|stale/i.test(latestStatus)
    : rows.length === 0;
  return {
    jobs: rows.length,
    latestStatus,
    latestStartedAt: latest
      ? String(latest.started_at ?? latest.created_at ?? "")
      : null,
    ok,
    source: "public.data_sync_jobs",
  };
}
