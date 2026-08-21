import { NextResponse } from "next/server";
import { requireVoiceAccess } from "@/lib/voice/access";
import { readVoiceDb } from "@/lib/voice/store";
import { overviewFromDb } from "@/lib/voice/overview";
import { filterVoiceDbByUnit } from "@/lib/voice/unit-filter";

export const dynamic = "force-dynamic";

export async function GET() {
  const access = await requireVoiceAccess();
  if (access.error) return access.error;
  const raw = await readVoiceDb();
  const db = filterVoiceDbByUnit(raw, access.unitScope);
  return NextResponse.json({
    ok: true,
    ...overviewFromDb(db),
    db,
    unitScope: access.unitScope.active
      ? {
          heltesName: access.unitScope.heltesName,
          albaName: access.unitScope.albaName,
        }
      : null,
  });
}
