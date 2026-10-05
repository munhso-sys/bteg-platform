"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { withBasePath } from "@/lib/paths";

export const JOB_POSITION_DRAG_MIME = "application/x-bgs-job-position";

export type DragJobPosition = {
  id: string;
  name: string;
};

export type DropLinkTarget =
  | { kind: "policy" }
  | { kind: "section"; sectionId: string }
  | { kind: "clause"; clauseId: string };

type ClauseRef = {
  id: string;
  sectionId?: string | null;
  parentId?: string | null;
};

type JobDragContextValue = {
  dragging: boolean;
  setDragging: (v: boolean) => void;
  dropBusy: boolean;
  lastError: string | null;
  clearError: () => void;
  linkDrop: (
    target: DropLinkTarget,
    positions: DragJobPosition[],
  ) => Promise<boolean>;
};

const JobDragContext = createContext<JobDragContextValue | null>(null);

async function readApiError(res: Response) {
  try {
    const data = (await res.json()) as { error?: string };
    if (data?.error) return data.error;
  } catch {
    // ignore
  }
  return `Алдаа (${res.status})`;
}

export function PolicyJobDragProvider({
  clauses,
  children,
}: {
  policyId: string;
  clauses: ClauseRef[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [dropBusy, setDropBusy] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const resolveClauseIds = useCallback(
    (target: DropLinkTarget): string[] => {
      if (target.kind === "policy") {
        return clauses.map((c) => c.id);
      }
      if (target.kind === "section") {
        return clauses
          .filter((c) => (c.sectionId ?? null) === target.sectionId)
          .map((c) => c.id);
      }
      return [target.clauseId];
    },
    [clauses],
  );

  const linkDrop = useCallback(
    async (target: DropLinkTarget, positions: DragJobPosition[]) => {
      const unique = [...new Map(positions.map((p) => [p.id, p])).values()];
      if (!unique.length) {
        setLastError("Ажлын байр сонгоогүй");
        return false;
      }
      const clauseIds = resolveClauseIds(target);
      if (!clauseIds.length) {
        setLastError("Холбох зүйл олдсонгүй");
        return false;
      }

      setDropBusy(true);
      setLastError(null);
      try {
        const items = clauseIds.flatMap((policy_clause_id) =>
          unique.map((p) => ({
            policy_clause_id,
            job_position_id: p.id,
            responsibility_type: "IMPLEMENTATION" as const,
            process_id: null,
            location_id: null,
            asset_id: null,
          })),
        );
        const CHUNK = 200;
        for (let i = 0; i < items.length; i += CHUNK) {
          const chunk = items.slice(i, i + CHUNK);
          const res = await fetch(withBasePath("/api/responsibilities"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              chunk.length === 1 ? chunk[0] : { items: chunk },
            ),
          });
          if (!res.ok) throw new Error(await readApiError(res));
        }
        router.refresh();
        return true;
      } catch (err) {
        setLastError(err instanceof Error ? err.message : "Холбож чадсангүй");
        return false;
      } finally {
        setDropBusy(false);
        setDragging(false);
      }
    },
    [resolveClauseIds, router],
  );

  const value = useMemo(
    (): JobDragContextValue => ({
      dragging,
      setDragging,
      dropBusy,
      lastError,
      clearError: () => setLastError(null),
      linkDrop,
    }),
    [dragging, dropBusy, lastError, linkDrop],
  );

  return (
    <JobDragContext.Provider value={value}>{children}</JobDragContext.Provider>
  );
}

export function usePolicyJobDrag() {
  return useContext(JobDragContext);
}

export function parseJobDragPayload(dt: DataTransfer): DragJobPosition[] {
  const raw =
    dt.getData(JOB_POSITION_DRAG_MIME) || dt.getData("text/plain") || "";
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as
      | DragJobPosition
      | DragJobPosition[]
      | { positions?: DragJobPosition[] };
    if (Array.isArray(parsed)) {
      return parsed
        .filter((p) => p?.id)
        .map((p) => ({ id: p.id, name: p.name || p.id }));
    }
    if (parsed && typeof parsed === "object" && "positions" in parsed) {
      const list = Array.isArray(parsed.positions) ? parsed.positions : [];
      return list
        .filter((p) => p?.id)
        .map((p) => ({ id: p.id, name: p.name || p.id }));
    }
    if (parsed && typeof parsed === "object" && "id" in parsed && parsed.id) {
      return [{ id: parsed.id, name: parsed.name || parsed.id }];
    }
  } catch {
    if (raw.trim()) return [{ id: raw.trim(), name: raw.trim() }];
  }
  return [];
}
