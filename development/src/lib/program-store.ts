"use client";

import { useCallback, useEffect, useState } from "react";
import { emptyQuarters, nextQuarterMark } from "./quarters";
import { researchFetch } from "./research/session-events";
import { useResearchSessionReady } from "./research/use-session-ready";
import type {
  ProgramInitiative,
  ProgramPillarId,
  QuarterKey,
} from "./types";

export const PROGRAM_STORAGE_KEY = "rd-program-initiatives-v1"; // legacy; not authoritative

export function emptyInitiative(
  pillarId: ProgramPillarId = "research",
  year = new Date().getFullYear(),
): ProgramInitiative {
  return {
    id: "",
    pillarId,
    no: 0,
    title: "",
    owner: "",
    department: "",
    score: 0,
    target: 100,
    status: "planned",
    year,
    start_date: "",
    end_date: "",
    quarters: emptyQuarters(),
  };
}

/**
 * Server-backed program initiatives (research_program_initiatives + RLS).
 * localStorage is not authoritative.
 */
export function useProgramInitiatives() {
  const { ready, failed } = useResearchSessionReady();
  const [items, setItems] = useState<ProgramInitiative[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const reload = useCallback(() => {
    setReloadTick((n) => n + 1);
  }, []);

  useEffect(() => {
    // Prefer a late-arriving session over a prior timeout failure.
    if (ready) {
      let cancelled = false;
      void (async () => {
        setLoading(true);
        setError(null);
        try {
          let res = await researchFetch("/api/research/program");
          if (res.status === 401) {
            await new Promise((r) => window.setTimeout(r, 600));
            if (cancelled) return;
            res = await researchFetch("/api/research/program");
          }
          const body = (await res.json().catch(() => null)) as {
            ok?: boolean;
            error?: string;
            items?: ProgramInitiative[];
          } | null;
          if (cancelled) return;
          if (!res.ok || !body?.ok) {
            setItems([]);
            setError(body?.error || `Load failed (${res.status})`);
            return;
          }
          setItems(body.items ?? []);
        } catch (e) {
          if (cancelled) return;
          setItems([]);
          setError(e instanceof Error ? e.message : "Load failed");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    if (failed) {
      setLoading(false);
      setItems([]);
      setError(
        typeof window !== "undefined" && window.parent === window
          ? "Нэвтрэх шаардлагатай. Портал (bteg.inspect.mn) → Судалгаа хөгжүүлэлт цэсээр нээнэ үү."
          : "Authentication required",
      );
    }
  }, [reloadTick, ready, failed]);

  async function save(next: ProgramInitiative) {
    setError(null);
    const isNew = !next.id || !items.some((i) => i.id === next.id);
    const res = await researchFetch("/api/research/program", {
      method: isNew ? "POST" : "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(isNew ? { ...next, id: undefined } : next),
    });
    const body = (await res.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
    } | null;
    if (!res.ok || !body?.ok) {
      setError(body?.error || `Save failed (${res.status})`);
      return false;
    }
    reload();
    return true;
  }

  async function remove(id: string) {
    setError(null);
    const res = await researchFetch(
      `/api/research/program?id=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    const body = (await res.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
    } | null;
    if (!res.ok || !body?.ok) {
      setError(body?.error || `Delete failed (${res.status})`);
      return false;
    }
    reload();
    return true;
  }

  async function cycleQuarter(id: string, key: QuarterKey) {
    const current = items.find((i) => i.id === id);
    if (!current) return false;
    const next: ProgramInitiative = {
      ...current,
      quarters: {
        ...current.quarters,
        [key]: nextQuarterMark(current.quarters[key] ?? "none"),
      },
    };
    return save(next);
  }

  return {
    items,
    save,
    remove,
    cycleQuarter,
    loading: (!ready && !failed) || loading,
    error,
    reload,
  };
}
