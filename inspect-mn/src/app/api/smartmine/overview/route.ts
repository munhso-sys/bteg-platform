import { NextResponse } from "next/server";
import { requireSmartMineAccess } from "@/lib/smartmine/access";
import { hasSmartMineDataConfig } from "@/lib/smartmine/client";
import { buildSmartMineOverview } from "@/lib/smartmine/overview";
import { parseSmartMineRange } from "@/lib/smartmine/range";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const access = await requireSmartMineAccess();
  if (access.error) return access.error;

  if (!hasSmartMineDataConfig()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "SmartMine өгөгдлийн холболт тохируулаагүй. SMARTMINE_SUPABASE_URL / SMARTMINE_SUPABASE_SERVICE_ROLE_KEY шаардлагатай.",
      },
      { status: 503 },
    );
  }

  try {
    const range = parseSmartMineRange(new URL(request.url).searchParams);
    const overview = await buildSmartMineOverview(range);
    return NextResponse.json(overview);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "SmartMine өгөгдөл уншиж чадсангүй";
    console.error("SMARTMINE OVERVIEW ERROR:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
