import {
  buildMaintenanceStats,
  buildProcessingStats,
  buildProcessingSummary,
  buildProcessingTrend,
  buildSyncStatus,
  extractRootCauseCandidates,
  fallbackReasonCandidates,
} from "./analytics";
import {
  fetchEquipmentOperationRows,
  fetchMaintenanceRows,
  fetchProcessingRows,
  fetchSyncRows,
} from "./fetch";
import type { DateRange } from "./range";
import type { SmartMineOverview } from "./types";

export async function buildSmartMineOverview(
  range: DateRange,
): Promise<SmartMineOverview> {
  const [
    processingRows,
    equipmentOperationResult,
    maintenanceRows,
    syncRows,
  ] = await Promise.all([
    fetchProcessingRows(range),
    fetchEquipmentOperationRows(range)
      .then((rows) => ({ rows, error: null as string | null }))
      .catch((error: unknown) => ({
        rows: [] as Array<Record<string, unknown>>,
        error:
          error instanceof Error
            ? error.message
            : "Equipment operation summary query failed",
      })),
    fetchMaintenanceRows(range),
    fetchSyncRows(range),
  ]);
  const equipmentOperationRows = equipmentOperationResult.rows;

  const processing = buildProcessingStats(processingRows);
  const processingTrend = buildProcessingTrend(processingRows, range);
  const processingSummary = buildProcessingSummary(
    processing,
    equipmentOperationRows,
    equipmentOperationResult.error,
  );
  const maintenance = buildMaintenanceStats(maintenanceRows, range);
  const sync = buildSyncStatus(syncRows);
  const fromSync = extractRootCauseCandidates(syncRows);
  const fallback = fallbackReasonCandidates(
    maintenance.series,
    maintenance.topEquipment,
    processing.recoveryPercent,
  );
  const reasons = [...fromSync, ...fallback].slice(0, 80);

  return {
    ok: true,
    from: range.from,
    to: range.to,
    fetchedAt: new Date().toISOString(),
    sources: {
      processing: "public.v_processing_dashboard",
      equipmentOperation: "public.v_smartmine_equipment_operation_summary",
      maintenance: "public.v_maintenance_work_order_dashboard",
      sync: "public.data_sync_jobs",
    },
    processing,
    processingTrend,
    processingSummary,
    maintenance: {
      workOrders: maintenance.workOrders,
      downtimeHours: maintenance.downtimeHours,
      mttrHours: maintenance.mttrHours,
      topEquipment: maintenance.topEquipment,
      bySector: maintenance.bySector,
      series: maintenance.series,
    },
    equipment: maintenance.equipment,
    reasons,
    sync,
    rowCounts: {
      processing: processingRows.length,
      equipmentOperation: equipmentOperationRows.length,
      maintenance: maintenanceRows.length,
      sync: syncRows.length,
    },
    warning: equipmentOperationResult.error ?? undefined,
  };
}
