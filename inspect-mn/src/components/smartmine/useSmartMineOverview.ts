"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  SMARTMINE_DEFAULT_FROM,
  todayIso,
} from "@/lib/smartmine/constants";
import type { SmartMineOverview } from "@/lib/smartmine/types";

export function useSmartMineOverview() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || SMARTMINE_DEFAULT_FROM;
  const to = searchParams.get("to") || todayIso();

  const [data, setData] = useState<SmartMineOverview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    params.set("from", from);
    params.set("to", to);
    return params.toString();
  }, [from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/smartmine/overview?${query}`, {
        cache: "no-store",
      });
      const json = (await res.json()) as SmartMineOverview | { ok: false; error?: string };
      if (!res.ok || !json.ok) {
        setData(null);
        setError(
          "error" in json && json.error ? json.error : "SmartMine өгөгдөл ачаалж чадсангүй",
        );
        return;
      }
      setData(json);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Алдаа");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(id);
  }, [load]);

  function setRange(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", nextFrom);
    params.set("to", nextTo);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return { from, to, setRange, query, data, error, loading, reload: load };
}

export function withRange(href: string, from: string, to: string) {
  const url = new URL(href, "http://local");
  url.searchParams.set("from", from);
  url.searchParams.set("to", to);
  return `${url.pathname}?${url.searchParams.toString()}`;
}
