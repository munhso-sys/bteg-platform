"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
} from "@xyflow/react";
import {
  ProcessFlowNodeView,
  type ProcessFlowNode,
} from "@/components/process/ProcessFlowNode";
import { ProcessNodeDrawer } from "@/components/process/ProcessNodeDrawer";
import type {
  ProcessHealth,
  ProcessNode,
  ProcessNodeTree,
} from "@/lib/types";

const nodeTypes = { process: ProcessFlowNodeView };

type Filters = {
  locationId: string;
  severity: "all" | ProcessHealth;
  level: "all" | ProcessNodeTree["level"];
};

function flattenTree(trees: ProcessNodeTree[]): ProcessNodeTree[] {
  const out: ProcessNodeTree[] = [];
  function walk(nodes: ProcessNodeTree[]) {
    for (const n of nodes) {
      out.push(n);
      walk(n.children);
    }
  }
  walk(trees);
  return out;
}

function layoutTree(trees: ProcessNodeTree[]): {
  nodes: ProcessFlowNode[];
  edges: Edge[];
} {
  const nodes: ProcessFlowNode[] = [];
  const edges: Edge[] = [];
  const colGap = 240;
  const rowGap = 120;

  function place(
    list: ProcessNodeTree[],
    depth: number,
    startX: number,
  ): number {
    let x = startX;
    for (const item of list) {
      const childWidth = Math.max(
        1,
        item.children.length || 1,
      );
      const subtreeSpan = Math.max(childWidth, 1) * colGap;
      const cx = x + subtreeSpan / 2 - colGap / 2;

      nodes.push({
        id: item.id,
        type: "process",
        position: { x: cx, y: depth * rowGap },
        data: {
          label: item.title,
          code: item.code,
          level: item.level,
          health: item.health ?? "neutral",
          description: item.description,
        },
      });

      if (item.parent_id) {
        edges.push({
          id: `e-${item.parent_id}-${item.id}`,
          source: item.parent_id,
          target: item.id,
          animated: item.health === "red" || item.health === "yellow",
          style: {
            stroke:
              item.health === "red"
                ? "var(--health-red)"
                : item.health === "yellow"
                  ? "var(--health-yellow)"
                  : "var(--brand)",
          },
        });
      }

      if (item.children.length) {
        place(item.children, depth + 1, x);
      }
      x += subtreeSpan;
    }
    return x;
  }

  place(trees, 0, 0);
  return { nodes, edges };
}

function matchesFilters(
  node: ProcessNodeTree,
  filters: Filters,
  flat: ProcessNodeTree[],
): boolean {
  if (filters.locationId && node.location_id !== filters.locationId) {
    // Keep ancestors of matching descendants
    const hasMatchingDesc = flat.some(
      (n) =>
        n.location_id === filters.locationId &&
        isDescendantOf(flat, n.id, node.id),
    );
    if (!hasMatchingDesc && node.id !== filters.locationId) {
      // also allow if any descendant matches location
      if (!hasMatchingDesc) return false;
    }
  }
  if (filters.severity !== "all" && (node.health ?? "neutral") !== filters.severity) {
    const hasMatchingDesc = flat.some(
      (n) =>
        (n.health ?? "neutral") === filters.severity &&
        isDescendantOf(flat, n.id, node.id),
    );
    if (!hasMatchingDesc && (node.health ?? "neutral") !== filters.severity) {
      return false;
    }
  }
  if (filters.level !== "all" && node.level !== filters.level) {
    // show ancestors so drill structure remains
    const hasChildOfLevel = flat.some(
      (n) => n.level === filters.level && isDescendantOf(flat, n.id, node.id),
    );
    if (!hasChildOfLevel) return false;
  }
  return true;
}

function isDescendantOf(
  flat: ProcessNodeTree[],
  nodeId: string,
  ancestorId: string,
): boolean {
  const byId = new Map(flat.map((n) => [n.id, n]));
  let cur = byId.get(nodeId);
  while (cur?.parent_id) {
    if (cur.parent_id === ancestorId) return true;
    cur = byId.get(cur.parent_id);
  }
  return false;
}

function filterTree(
  trees: ProcessNodeTree[],
  filters: Filters,
): ProcessNodeTree[] {
  const flat = flattenTree(trees);
  function filterList(list: ProcessNodeTree[]): ProcessNodeTree[] {
    return list
      .map((n) => ({
        ...n,
        children: filterList(n.children),
      }))
      .filter(
        (n) =>
          matchesFilters(n, filters, flat) || n.children.length > 0,
      );
  }
  return filterList(trees);
}

function ProcessMapInner() {
  const [tree, setTree] = useState<ProcessNodeTree[]>([]);
  const [flatNodes, setFlatNodes] = useState<ProcessNode[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>({
    locationId: "",
    severity: "all",
    level: "all",
  });

  const [nodes, setNodes, onNodesChange] = useNodesState<ProcessFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [treeRes, listRes] = await Promise.all([
        fetch("/api/v1/processes/tree"),
        fetch("/api/v1/processes"),
      ]);
      const treeJson = (await treeRes.json()) as {
        data?: ProcessNodeTree[];
        error?: string;
      };
      const listJson = (await listRes.json()) as {
        data?: ProcessNode[];
        error?: string;
      };
      if (!treeRes.ok) throw new Error(treeJson.error || "Tree load failed");
      setTree(treeJson.data ?? []);
      setFlatNodes(listJson.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(
    () => filterTree(tree, filters),
    [tree, filters],
  );

  useEffect(() => {
    const laid = layoutTree(filtered);
    setNodes(laid.nodes);
    setEdges(laid.edges);
  }, [filtered, setNodes, setEdges]);

  const locations = useMemo(() => {
    const set = new Set<string>();
    for (const n of flatNodes) {
      if (n.location_id) set.add(n.location_id);
    }
    return [...set].sort();
  }, [flatNodes]);

  const selectedNode =
    flatNodes.find((n) => n.id === selectedId) ?? null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-end gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4 py-3">
        <div>
          <h1 className="text-lg font-semibold">Процессын зураг</h1>
          <p className="text-xs text-[var(--muted)]">
            L1→L4 drill-down · health badge · модуль холболт
          </p>
        </div>
        <label className="text-xs">
          <span className="mb-1 block text-[var(--muted)]">Байршил</span>
          <select
            className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5"
            value={filters.locationId}
            onChange={(e) =>
              setFilters((f) => ({ ...f, locationId: e.target.value }))
            }
          >
            <option value="">Бүгд</option>
            {locations.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-[var(--muted)]">Эрчим / health</span>
          <select
            className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5"
            value={filters.severity}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                severity: e.target.value as Filters["severity"],
              }))
            }
          >
            <option value="all">Бүгд</option>
            <option value="green">Ногоон</option>
            <option value="yellow">Шар</option>
            <option value="red">Улаан</option>
            <option value="neutral">Саарал</option>
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-1 block text-[var(--muted)]">Түвшин</span>
          <select
            className="rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-1.5"
            value={filters.level}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                level: e.target.value as Filters["level"],
              }))
            }
          >
            <option value="all">Бүгд</option>
            <option value="L1_MACRO">L1</option>
            <option value="L2_SUBPROCESS">L2</option>
            <option value="L3_ACTIVITY">L3</option>
            <option value="L4_TASK">L4</option>
          </select>
        </label>
        <button
          type="button"
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium hover:bg-black/5"
          onClick={() => void load()}
        >
          Шинэчлэх
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        {loading ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-[var(--background)]/70 text-sm text-[var(--muted)]">
            Ачаалж байна…
          </div>
        ) : null}
        {error ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center text-sm text-[var(--danger)]">
            {error}
          </div>
        ) : null}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.3}
          onNodeClick={(_e, n) => setSelectedId(n.id)}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={18} size={1} />
          <Controls />
          <MiniMap
            nodeColor={(n) => {
              const h = (n.data as ProcessFlowNode["data"] | undefined)?.health;
              if (h === "green") return "#15803d";
              if (h === "yellow") return "#ca8a04";
              if (h === "red") return "#dc2626";
              return "#64748b";
            }}
          />
        </ReactFlow>
      </div>

      <ProcessNodeDrawer
        node={selectedNode}
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

export function ProcessMapView() {
  return (
    <ReactFlowProvider>
      <div className="h-[calc(100dvh-0px)] min-h-[480px]">
        <ProcessMapInner />
      </div>
    </ReactFlowProvider>
  );
}
