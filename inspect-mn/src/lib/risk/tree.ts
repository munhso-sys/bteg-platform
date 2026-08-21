import type { TreeNode } from "@/lib/reports/types";
import type { RiskOverview, RiskSignal } from "@/lib/risk/types";
import { isUnplanned, RISK_SOURCE_LABEL } from "@/lib/risk/filter";

function node(
  id: string,
  label: string,
  children: TreeNode[],
  count?: number,
): TreeNode {
  const summed = children.reduce((s, c) => s + (c.count ?? 0), 0);
  return { id, label, kind: "folder", count: count ?? summed, children };
}

function leaf(id: string, label: string, href: string, count: number): TreeNode {
  return { id, label, kind: "report", href, count };
}

function itemLeaves(
  items: RiskSignal[],
  prefix: string,
  moreHref: string,
  limit = 8,
): TreeNode[] {
  const shown = items.slice(0, limit);
  const leaves = shown.map((item) =>
    leaf(
      `${prefix}-${item.id}`,
      item.title,
      `/risk-management/register?id=${encodeURIComponent(item.id)}`,
      1,
    ),
  );
  if (items.length > shown.length) {
    leaves.push(
      leaf(
        `${prefix}-more`,
        `Бүгдийг харах (${items.length})`,
        moreHref,
        items.length - shown.length,
      ),
    );
  }
  return leaves;
}

export function buildRiskTree(data: RiskOverview): TreeNode[] {
  const items = data.items;
  const high = items.filter((i) => i.severity === "high" || i.severity === "critical");
  const medium = items.filter((i) => i.severity === "medium");
  const low = items.filter((i) => i.severity === "low");
  const overdue = items.filter((i) => i.status === "overdue");
  const inProgress = items.filter((i) => i.status === "in_progress");
  const unplanned = items.filter(isUnplanned);
  const mitigated = items.filter((i) => i.status === "mitigated");

  const units = new Map<string, RiskSignal[]>();
  for (const item of items) {
    const key = item.unit.trim() || "Тодорхойгүй";
    const list = units.get(key) ?? [];
    list.push(item);
    units.set(key, list);
  }
  const unitNodes = [...units.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 12)
    .map(([unit, list]) =>
      node(
        `unit-${unit}`,
        unit,
        itemLeaves(
          list,
          `u-${unit}`,
          `/risk-management/register?unit=${encodeURIComponent(unit)}`,
        ),
        list.length,
      ),
    );

  return [
    node("risk-root", "Эрсдэлийн удирдлага", [
      node("src", "Эх үүсвэр", [
        ...(["inspection", "policy", "development", "voice"] as const).map((source) => {
          const list = items.filter((i) => i.source === source);
          return node(
            `src-${source}`,
            RISK_SOURCE_LABEL[source],
            itemLeaves(
              list,
              source,
              `/risk-management/sources?source=${source}`,
            ),
            list.length,
          );
        }),
      ]),
      node("sev", "Зэрэглэл", [
        node(
          "sev-high",
          "Өндөр / ноцтой",
          itemLeaves(high, "high", "/risk-management/register?filter=high"),
          high.length,
        ),
        node(
          "sev-mid",
          "Дунд",
          itemLeaves(medium, "mid", "/risk-management/register?filter=medium"),
          medium.length,
        ),
        node(
          "sev-low",
          "Бага",
          itemLeaves(low, "low", "/risk-management/register?filter=low"),
          low.length,
        ),
      ]),
      node("work", "Засвар ажил", [
        node(
          "work-over",
          "Хугацаа хэтэрсэн",
          itemLeaves(overdue, "over", "/risk-management/work?status=overdue"),
          overdue.length,
        ),
        node(
          "work-prog",
          "Хийгдэж байгаа",
          itemLeaves(inProgress, "prog", "/risk-management/work?status=in_progress"),
          inProgress.length,
        ),
        node(
          "work-none",
          "Төлөвлөгөөгүй",
          itemLeaves(unplanned, "none", "/risk-management/work?status=unplanned"),
          unplanned.length,
        ),
        node(
          "work-done",
          "Засагдсан",
          itemLeaves(mitigated, "done", "/risk-management/register"),
          mitigated.length,
        ),
      ]),
      node("units", "Нэгж", unitNodes, items.length),
      node("pages", "Дэд хуудас", [
        leaf("p-dash", "Самбар", "/risk-management", data.kpis.active),
        leaf("p-reg", "Бүртгэл", "/risk-management/register", items.length),
        leaf("p-mx", "Матриц", "/risk-management/matrix", data.matrix.length),
        leaf("p-work", "Засвар", "/risk-management/work", inProgress.length + overdue.length),
        leaf("p-src", "Эх үүсвэр", "/risk-management/sources", data.bySource.length),
      ]),
    ]),
  ];
}
