import type { AccessOptions } from "./types";
import bundledCatalog from "./org-catalog.json";

function positionCodeLabel(code: string) {
  return code.replace(/_/g, " ").replace(/-/g, " · ").trim();
}

type RawCatalog = {
  heltes: Array<{
    id: string;
    name: string;
    albas: Array<{
      id: string;
      name: string;
      position_codes?: string[];
    }>;
  }>;
};

/** Immutable bundled org catalog (shipped in the Vercel function bundle). */
export function loadBundledOrgAccessOptions(): AccessOptions {
  const raw = bundledCatalog as RawCatalog;
  if (!Array.isArray(raw.heltes) || raw.heltes.length === 0) {
    throw new Error("ORG_CATALOG_INVALID");
  }

  return {
    heltes: raw.heltes.map((h) => ({
      id: h.id,
      name:
        h.name === "Дотоод хяналтын хэлтэс"
          ? "Дотоод хяналт шалгалтын хэлтэс"
          : h.name,
      albas: h.albas.map((a) => ({
        id: a.id,
        name:
          a.name === "Дотоод хяналтын хэлтэс"
            ? "Дотоод хяналт шалгалтын хэлтэс"
            : a.name,
        positions: (a.position_codes ?? []).map((code) => ({
          id: `code:${code}`,
          name: positionCodeLabel(code),
        })),
      })),
    })),
  };
}
