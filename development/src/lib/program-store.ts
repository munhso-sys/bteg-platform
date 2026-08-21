"use client";

import { useEffect, useState } from "react";
import { initiatives as seedInitiatives } from "./program-data";
import { emptyQuarters, nextQuarterMark } from "./quarters";
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

function loadInitiatives(): ProgramInitiative[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedInitiatives;
    const parsed = JSON.parse(raw) as ProgramInitiative[];
    if (!Array.isArray(parsed) || parsed.length === 0) return seedInitiatives;
    return parsed.map((item) => ({
      ...emptyInitiative(),
      ...item,
      quarters: { ...emptyQuarters(), ...item.quarters },
    }));
  } catch {
    return seedInitiatives;
  }
}

export function useProgramInitiatives() {
  const [items, setItems] = useState<ProgramInitiative[]>(seedInitiatives);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setItems(loadInitiatives());
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [hydrated, items]);

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
