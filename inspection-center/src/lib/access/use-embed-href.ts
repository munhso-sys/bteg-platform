"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";

const STORAGE_KEY = "inspection_embed_token";

/** Keep signed embed token across client navigations inside the iframe. */
export function useEmbedHref() {
  const searchParams = useSearchParams();
  const embedFromUrl = searchParams.get("embed");

  useEffect(() => {
    if (!embedFromUrl) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, embedFromUrl);
    } catch {
      // ignore
    }
  }, [embedFromUrl]);

  const embed = useMemo(() => {
    if (embedFromUrl) return embedFromUrl;
    if (typeof window === "undefined") return null;
    try {
      return sessionStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }, [embedFromUrl]);

  const withEmbed = useCallback(
    (href: string) => {
      if (!embed) return href;
      const [path, query = ""] = href.split("?");
      const params = new URLSearchParams(query);
      params.set("embed", embed);
      const qs = params.toString();
      return qs ? `${path}?${qs}` : path;
    },
    [embed],
  );

  return { embed, withEmbed };
}
