"use client";

import { useEffect, useState } from "react";
import { initiatives as seedInitiatives } from "./program-data";
import { emptyQuarters, nextQuarterMark } from "./quarters";
import {
  RD_PROGRAM_BASE_KEY,
  clearLegacyRdSharedKeys,
  readRdJsonArray,
  writeRdJsonArray,
} from "./rd-storage";
import { useRdUserId } from "./use-rd-user-id";
import type {
  ProgramInitiative,
  ProgramPillarId,
  QuarterKey,
} from "./types";

const STORAGE_KEY = "rd-program-initiatives-v1";
export const PROGRAM_STORAGE_KEY = STORAGE_KEY;

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

function loadInitiatives(userId: string | null): ProgramInitiative[] {
  const namespaced = readRdJsonArray<ProgramInitiative>(
    window.localStorage,
    RD_PROGRAM_BASE_KEY,
    userId,
  );
  if (!namespaced || namespaced.length === 0) return seedInitiatives;
  return namespaced.map((item) => ({
    ...emptyInitiative(),
    ...item,
    quarters: { ...emptyQuarters(), ...item.quarters },
  }));
}

export function useProgramInitiatives() {
  const { userId, ready } = useRdUserId();
  const [items, setItems] = useState<ProgramInitiative[]>(seedInitiatives);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      clearLegacyRdSharedKeys(window.localStorage);
      setItems(loadInitiatives(userId));
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [ready, userId]);

  useEffect(() => {
    if (!hydrated || !ready) return;
    writeRdJsonArray(window.localStorage, RD_PROGRAM_BASE_KEY, userId, items);
  }, [hydrated, ready, userId, items]);

  function save(next: ProgramInitiative) {
    setItems((prev) => {
      const row = {
        ...next,
        id: next.id || `rd-${Date.now()}`,
        no: next.no || prev.length + 1,
        score: Math.max(0, Math.min(next.target || 100, Number(next.score) || 0)),
      };
      const exists = prev.some((item) => item.id === row.id);
      return exists
        ? prev.map((item) => (item.id === row.id ? row : item))
        : [...prev, row];
    });
  }

  function remove(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function cycleQuarter(id: string, key: QuarterKey) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              quarters: {
                ...item.quarters,
                [key]: nextQuarterMark(item.quarters[key] ?? "none"),
              },
            }
          : item,
      ),
    );
  }

  return { items, save, remove, cycleQuarter };
}
