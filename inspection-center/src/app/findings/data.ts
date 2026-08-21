import type { ViolationFolder } from "@/components/findings/ViolationTreeTable";
import {
  buildLiveSidebarDashboard,
  type LiveSidebarDashboard,
} from "@/lib/findings/live-sidebar-dashboard";
import {
  ensureStoreHydrated,
  readMasterWorkbook,
  readStore,
} from "@/lib/store";
import { readScopedStore } from "@/lib/access/scope";

export function formatCount(value: number | null | undefined) {
  return value == null ? "-" : String(value);
}

export function formatPercent(value: number | null | undefined) {
  if (value == null) return "-";
  return `${Math.round(value * 100)}%`;
}

type DashboardCache = {
  key: string;
  at: number;
  value: LiveSidebarDashboard;
};

const DASHBOARD_TTL_MS = 30_000;

function dashboardMemory(): { cache?: DashboardCache } {
  const g = globalThis as typeof globalThis & {
    __inspectionFindingsDashboard?: { cache?: DashboardCache };
  };
  if (!g.__inspectionFindingsDashboard) g.__inspectionFindingsDashboard = {};
  return g.__inspectionFindingsDashboard;
}

export async function loadFindingsDashboard(): Promise<LiveSidebarDashboard> {
  await ensureStoreHydrated();
  const { data } = await readScopedStore();
  const store = readStore();
  const cacheKey = [
    data.findings.length,
    data.actions.length,
    data.runs.length,
    store.runs.reduce(
      (max, run) => Math.max(max, Date.parse(run.updatedAt) || 0),
      0,
    ),
  ].join(":");
  const memory = dashboardMemory();
  const hit = memory.cache;
  if (hit && hit.key === cacheKey && Date.now() - hit.at < DASHBOARD_TTL_MS) {
    return hit.value;
  }
  const value = buildLiveSidebarDashboard(data, readMasterWorkbook());
  memory.cache = { key: cacheKey, at: Date.now(), value };
  return value;
}

export function buildStateTree(dashboard: LiveSidebarDashboard): {
  tree: ViolationFolder[];
  violationTotal: number;
  openTotal: number;
} {
  const shownItems = dashboard.state.items.filter(
    (row) => row.violationCount > 0,
  );
  const authorities = new Map<string, ViolationFolder>();
  for (const row of shownItems) {
    const authority =
      authorities.get(row.authorityKey) ??
      ({
        key: `state-auth-${row.authorityKey}`,
        label: row.authority,
        children: [],
      } satisfies ViolationFolder);
    let checklist = authority.children.find(
      (child) =>
        "children" in child && child.key === `state-cl-${row.checklistKey}`,
    ) as ViolationFolder | undefined;
    if (!checklist) {
      checklist = {
        key: `state-cl-${row.checklistKey}`,
        label: [
          row.checklistNumber ? `№${row.checklistNumber}` : null,
          row.checklistName,
        ]
          .filter(Boolean)
          .join(" — "),
        children: [],
      };
      authority.children.push(checklist);
    }
    checklist.children.push({
      key: row.key,
      label: row.item,
      violationCount: row.violationCount,
      openCount: row.openCount,
      resolvedPercent: row.resolvedPercent,
    });
    authorities.set(row.authorityKey, authority);
  }
  return {
    tree: [...authorities.values()],
    violationTotal: shownItems.reduce((sum, row) => sum + row.violationCount, 0),
    openTotal: shownItems.reduce((sum, row) => sum + row.openCount, 0),
  };
}

export function buildNightTree(dashboard: LiveSidebarDashboard): {
  tree: ViolationFolder[];
  violationTotal: number;
  openTotal: number;
} {
  const shownItems = dashboard.night.items.filter(
    (row) => row.isViolationIndicator && row.violationCount > 0,
  );
  const areas = new Map<string, ViolationFolder>();
  for (const row of shownItems) {
    const area =
      areas.get(row.areaKey) ??
      ({
        key: `night-area-${row.areaKey}`,
        label: row.areaName,
        children: [],
      } satisfies ViolationFolder);
    const sectionKey = `${row.areaKey}::${row.sectionNo || row.sectionTitle}`;
    let section = area.children.find(
      (child) =>
        "children" in child && child.key === `night-section-${sectionKey}`,
    ) as ViolationFolder | undefined;
    if (!section) {
      section = {
        key: `night-section-${sectionKey}`,
        label: `${row.sectionNo ? `${row.sectionNo}. ` : ""}${row.sectionTitle}`,
        children: [],
      };
      area.children.push(section);
    }
    section.children.push({
      key: row.key,
      label: row.item,
      violationCount: row.violationCount,
      openCount: row.openCount,
      resolvedPercent: row.resolvedPercent,
    });
    areas.set(row.areaKey, area);
  }
  return {
    tree: [...areas.values()],
    violationTotal: shownItems.reduce((sum, row) => sum + row.violationCount, 0),
    openTotal: shownItems.reduce((sum, row) => sum + row.openCount, 0),
  };
}

export function buildJointTree(dashboard: LiveSidebarDashboard): {
  tree: ViolationFolder[];
  violationTotal: number;
  openTotal: number;
} {
  const shownItems = dashboard.joint.items.filter(
    (row) => row.violationCount > 0,
  );
  const categories = new Map<string, ViolationFolder>();
  for (const row of shownItems) {
    const category =
      categories.get(row.categoryKey) ??
      ({
        key: `joint-cat-${row.categoryKey}`,
        label: row.categoryName,
        children: [],
      } satisfies ViolationFolder);
    category.children.push({
      key: row.key,
      label: row.item,
      violationCount: row.violationCount,
      openCount: row.openCount,
      resolvedPercent: row.resolvedPercent,
    });
    categories.set(row.categoryKey, category);
  }
  return {
    tree: [...categories.values()],
    violationTotal: shownItems.reduce((sum, row) => sum + row.violationCount, 0),
    openTotal: shownItems.reduce((sum, row) => sum + row.openCount, 0),
  };
}
