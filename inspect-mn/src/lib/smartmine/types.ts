export type SmartMineDateRange = {
  from: string;
  to: string;
};

export type DualAxisPoint = {
  date: string;
  mttrHours: number;
  downtimeHours: number;
  workOrders: number;
};

export type ProcessingTrendPoint = {
  date: string;
  oreFeedTonnes: number;
  concentrateTonnes: number;
};

export type ProcessingEquipmentCategory = "Dump" | "Exca" | "Loader" | "Bulldozer";

export type ProcessingEquipmentSummary = {
  category: ProcessingEquipmentCategory;
  count: number | null;
  operatedHours: number | null;
};

export type ProcessingPlantSummary = {
  name: string;
  oreFeedTonnes: number;
  concentrateTonnes: number;
  recoveryPct: number;
  activeDays: number;
};

export type ProcessingSummary = {
  equipment: ProcessingEquipmentSummary[];
  equipmentAvailable: boolean;
  missingEquipmentSource: string | null;
  plants: ProcessingPlantSummary[];
  totalOperatedHours: number | null;
  avgOperatedHoursPerActive: number | null;
};

export type ProcessingPlantRow = {
  plantName: string;
  oreFeedTons: number;
  concentrateTons: number;
  recoveryPercent: number;
  processingDays: number;
};

export type ProcessingDailyRow = {
  date: string;
  plantName: string;
  oreFeedTons: number;
  concentrateTons: number;
  recoveryPercent: number;
};

export type EquipmentRow = {
  machineId: string;
  machineName: string;
  sectorName: string;
  workOrders: number;
  openWorkOrders: number;
  downtimeHours: number;
  mttrHours: number;
  lastDay: string | null;
};

export type SectorRow = {
  sectorName: string;
  workOrders: number;
  downtimeHours: number;
};

export type ReasonCandidate = {
  id: string;
  title: string;
  detail: string;
  severity: "critical" | "high" | "medium" | "info";
  source: string;
  date: string | null;
  metric?: "mttr" | "downtime" | "processing" | "sync";
};

export type SyncStatus = {
  jobs: number;
  latestStatus: string | null;
  latestStartedAt: string | null;
  ok: boolean;
  source: string;
};

export type SmartMineOverview = {
  ok: true;
  from: string;
  to: string;
  fetchedAt: string;
  sources: {
    processing: string;
    equipmentOperation: string;
    maintenance: string;
    sync: string;
  };
  processing: {
    oreFeedTons: number;
    concentrateTons: number;
    recoveryPercent: number;
    processingDays: number;
    plants: ProcessingPlantRow[];
    daily: ProcessingDailyRow[];
  };
  processingTrend: ProcessingTrendPoint[];
  processingSummary: ProcessingSummary;
  maintenance: {
    workOrders: number;
    downtimeHours: number;
    mttrHours: number;
    topEquipment: string;
    bySector: SectorRow[];
    series: DualAxisPoint[];
  };
  equipment: EquipmentRow[];
  reasons: ReasonCandidate[];
  sync: SyncStatus;
  rowCounts: {
    processing: number;
    equipmentOperation: number;
    maintenance: number;
    sync: number;
  };
  warning?: string;
};

export type SmartMineOverviewResponse =
  | SmartMineOverview
  | { ok: false; error: string };
