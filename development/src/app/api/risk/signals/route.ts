import { NextResponse } from "next/server";
import { developmentRiskSignals } from "@/lib/risk/signals";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = developmentRiskSignals();
    return NextResponse.json({
      ok: true,
      source: "development",
      generatedAt: new Date().toISOString(),
      items,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Эрсдэлийн дохио уншигдсангүй",
        items: [],
      },
      { status: 500 },
    );
  }
}
