import { NextResponse } from "next/server";
import { getDutyModuleApps } from "@/lib/module-apps";
import { loadBundledOrgAccessOptions } from "@/lib/org/catalog";
import type { AccessOptions } from "@/lib/org/types";

/**
 * Vercel team membership only unlocks Deployment Protection.
 * Application authorization always comes from Preview Supabase session +
 * active user_profiles + RBAC — never from Vercel identity.
 */

async function loadFromPolicy(): Promise<AccessOptions | null> {
  const origin = getDutyModuleApps()["policy-compliance"].origin;
  try {
    const res = await fetch(`${origin}/api/org/access-options`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean } & AccessOptions;
    if (!json.ok || !Array.isArray(json.heltes) || json.heltes.length === 0) {
      return null;
    }
    return { heltes: json.heltes };
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const remote = await loadFromPolicy();
    const data = remote ?? loadBundledOrgAccessOptions();
    if (!data.heltes.length) {
      return NextResponse.json(
        { ok: false, error: "Org catalog empty", code: "ORG_CATALOG_EMPTY" },
        { status: 500 },
      );
    }
    return NextResponse.json({
      ok: true,
      source: remote ? "policy" : "local",
      ...data,
    });
  } catch (err) {
    const code =
      err instanceof Error && err.message === "ORG_CATALOG_INVALID"
        ? "ORG_CATALOG_INVALID"
        : "ORG_OPTIONS_FAILED";
    console.error("[api/org/options]", code);
    return NextResponse.json(
      {
        ok: false,
        code,
        error: "Байгууллагын жагсаалт ачаалахад алдаа гарлаа.",
      },
      { status: 500 },
    );
  }
}
