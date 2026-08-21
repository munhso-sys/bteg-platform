"use client";

import { useCallback, useEffect, useState } from "react";
import type { RiskOverview } from "@/lib/risk/types";

export function useRiskOverview() {
  const [data, setData] = useState<RiskOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/risk/overview", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || "Эрсдэлийн мэдээлэл уншигдсангүй");
        setData(null);
        return;
      }
      setData(json as RiskOverview);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  return { data, error, loading, load };
}
