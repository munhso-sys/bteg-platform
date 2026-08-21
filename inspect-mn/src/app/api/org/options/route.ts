import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { getDutyModuleApps } from "@/lib/module-apps";

type AccessOptions = {
  heltes: Array<{
    id: string;
    name: string;
    albas: Array<{
      id: string;
      name: string;
      positions: Array<{ id: string; name: string }>;
    }>;
  }>;
};

function positionCodeLabel(code: string) {
  return code.replace(/_/g, " ").replace(/-/g, " · ").trim();
}

async function loadLocalCatalog(): Promise<AccessOptions> {
  const p = path.join(process.cwd(), "data", "reference", "org-catalog.json");
  const raw = JSON.parse(await fs.readFile(p, "utf8")) as {
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

async function loadFromPolicy(): Promise<AccessOptions | null> {
  const origin = getDutyModuleApps()["policy-compliance"].origin;
  try {
    const res = await fetch(`${origin}/api/org/access-options`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean } & AccessOptions;
    if (!json.ok || !Array.isArray(json.heltes)) return null;
    return { heltes: json.heltes };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const remote = await loadFromPolicy();
    const data = remote ?? (await loadLocalCatalog());
    return NextResponse.json({ ok: true, source: remote ? "policy" : "local", ...data });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Org options failed",
      },
      { status: 500 },
    );
  }
}
